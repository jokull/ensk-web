import { motion } from "framer-motion";

export default function Loading() {
  return (
    <motion.div
      className="flex w-[22px] h-5 justify-between"
      variants={{
        start: { transition: { staggerChildren: 0.2 } },
        end: { transition: { staggerChildren: 0.1 } },
      }}
      initial="start"
      animate="end"
    >
      {[1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="bg-neutral-600 block rounded-full w-1.5 h-1.5"
          variants={{
            start: { y: "50%" },
            end: { y: "150%" },
          }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            repeatType: "reverse",
            stiffness: 0.8,
          }}
        />
      ))}
    </motion.div>
  );
}
