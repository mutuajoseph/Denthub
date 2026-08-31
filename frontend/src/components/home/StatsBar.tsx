import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useSiteContentStore } from "../../store/siteContentStore";

function Counter({
  value,
  suffix,
  active,
}: {
  value: number;
  suffix: string;
  active: boolean;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = Math.ceil(value / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else setCount(start);
    }, 30);
    return () => clearInterval(timer);
  }, [active, value]);
  return (
    <span className="text-3xl md:text-4xl font-bold text-orange-500 font-display dark:text-gold-400">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function StatsBar() {
  const stats = useSiteContentStore((s) => s.home.stats);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  return (
    <section
      ref={ref}
      className="border-y border-slate-200 bg-white/80 py-12 dark:border-navy-600 dark:bg-navy-950"
    >
      <div className="mx-auto max-w-7xl px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1 }}
            className="text-center"
          >
            <Counter value={stat.value} suffix={stat.suffix} active={inView} />
            <p className="text-sm text-slate-500 mt-2 dark:text-gray-400">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
