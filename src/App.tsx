import { useMemo, useState } from "react";
import classNames from "classnames";
import initSqlJs, { Database } from "sql.js";
import wasmURL from "./sql-wasm-fts5.wasm?url";
import dbURL from "./dict.db?url";
import useSWR from "swr";
import Loading from "./Loading";
import Fuse from "fuse.js";

async function getDb() {
  const [SQL, buf] = await Promise.all([
    initSqlJs({ locateFile: () => `${wasmURL}` }),
    fetch(dbURL).then((res) => res.arrayBuffer()),
  ]);
  return new SQL.Database(new Uint8Array(buf));
}

const SVGSearch = ({ className }: { className: string }) => (
  <svg
    width="24"
    height="24"
    fill="none"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19.25 19.25L15.5 15.5M4.75 11C4.75 7.54822 7.54822 4.75 11 4.75C14.4518 4.75 17.25 7.54822 17.25 11C17.25 14.4518 14.4518 17.25 11 17.25C7.54822 17.25 4.75 14.4518 4.75 11Z"
    ></path>
  </svg>
);

interface Row {
  id: number;
  word: string;
  definition: string;
  ipa_uk: string;
  ipa_us: string;
}

function random(db: Database): Row {
  const stmt = db.prepare(`
  select
    id, word, definition, ipa_uk, ipa_us
  from
    dictionary
  order by RANDOM() limit 1
  `);
  const response = stmt.getAsObject({});
  stmt.free();
  return response as unknown as Row;
}

function search(db: Database, query: string): Row[] {
  const stmt = db.prepare(`
    select
      id, word, definition, ipa_uk, ipa_us
    from
      dictionary
    where rowid in (
      select rowid
      from dictionary_fts
      where dictionary_fts match :query
      order by rank)
    limit 101
  `);
  stmt.bind({ ":query": `${query}*` });
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject() as unknown as Row);
  stmt.free();
  const fuse = new Fuse(results, {
    keys: ["word"],
    findAllMatches: true,
    includeScore: true,
  })
    .search(query)
    .map(({ item }) => item);
  return [
    // Prioritize fuse results because it's good at fuzzy ranking, giving whole word results better
    // scores
    ...fuse,
    // ... but also include the rest of the SQLite FTS results
    ...results.filter((row) => !fuse.find(({ id }) => id === row.id)),
  ];
}

function Results({ results }: { results: Row[] }) {
  return (
    <div className="space-y-3 my-5">
      {results.map((result) => (
        <div key={result.id}>
          <div className="font-bold">{result.word}</div>
          <div>{result.definition}</div>
        </div>
      ))}
    </div>
  );
}

function Search({ db }: { db: Database }) {
  const [initial, setInitial] = useState<Row | null>(random(db));
  const [query, setQuery] = useState(initial?.word || "");
  const results = useMemo(() => (query ? search(db, query) : []), [query]);
  return (
    <div className="w-full">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -mt-3">
          <SVGSearch className="w-6 h-6 text-neutral-400 group-focus-within:text-neutral-600" />
        </div>
        <input
          className={classNames(
            "rounded-lg text-xl px-3 py-2 w-full pl-12",
            "bg-neutral-200 focus:bg-neutral-100",
            "border border-transparent ",
            "focus:outline-none",
            "placeholder:text-neutral-500 group-focus-within:placeholder:text-neutral-300",
            "transition-colors"
          )}
          value={query}
          onChange={({ target }) => {
            setQuery(target.value);
            setInitial(null);
          }}
          placeholder="Leita að ensku orði"
          autoFocus={true}
        />
      </div>
      <Results results={results} />
    </div>
  );
}

function App() {
  const { data } = useSWR("db", getDb);

  return (
    <div className="sm:pt-[15vh] mx-auto max-w-md w-full p-4">
      <header className="mb-4 sm:mb-8">
        <div className="flex justify-start">
          <div className="text-4xl mr-2">📗</div>
          <div className="grow">
            <h1 className="font-black text-4xl">enski</h1>
            <h2 className="text-neutral-700">
              Gögn frá{" "}
              <a href="https://ensk.is" className="underline">
                ensk.is
              </a>{" "}
              - kóði á{" "}
              <a
                href="https://github.com/jokull/enski-web"
                className="underline"
              >
                github
              </a>
            </h2>
          </div>
        </div>
      </header>
      <div className="group flex justify-around items-center">
        {data ? (
          <Search db={data} />
        ) : (
          <div className="p-3">
            <Loading />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
