export function PageHero({ eyebrow, heading, intro, children }) {
  return (
    <section className="px-6 pb-16 pt-28 text-center sm:pb-24 sm:pt-36">
      <p className="landing-eyebrow">{eyebrow}</p>
      <h1 className="mx-auto mt-4 max-w-3xl text-[2.125rem] font-semibold leading-[1.1] tracking-tight [text-wrap:balance] sm:text-5xl md:text-6xl">{heading}</h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground [text-wrap:pretty] sm:mt-6 sm:text-lg">{intro}</p>
      {children}
    </section>
  )
}
