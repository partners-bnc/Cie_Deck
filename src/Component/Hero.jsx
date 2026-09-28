import { Link } from "react-router-dom";

const logos = [
  "Accountant",
  "Audit",
  "Finance",
  "Technology",
  "Data Domain",
  "Business Setup",
  "Human Resource",
];

export default function Hero() {
  return (
    <main className="page-shell min-h-screen overflow-hidden hero-enter pt-20 sm:pt-24">
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-12 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-center gap-7 lg:-mt-1">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#0B2F5B]/15 bg-white/70 px-3.5 py-1 text-xs font-semibold tracking-wide text-[#0B2F5B] shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0B2F5B] animate-pulse" />
            Next-Gen Recruitment Platform
          </div>

          <h1 className="text-[34px] font-extrabold tracking-[-0.03em] leading-[1.12] text-[#0f172a] sm:text-[48px] lg:text-[54px]">
            Fastest way to <span className="text-[#0B2F5B]">hire talent</span> and land your <span className="text-[#0B2F5B]">next role</span>
          </h1>

          <p className="max-w-xl text-[16px] leading-relaxed text-[#475569] sm:text-[18px]">
            Connect employers with standout candidates through curated, pre-vetted hiring — not messy job boards.
          </p>

          <div className="hero-actions flex flex-wrap items-center gap-4 pt-1">
            <Link
              to="/employers"
              className="inline-flex items-center justify-center rounded-full bg-[#0B2F5B] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_25px_-5px_rgba(11,47,91,0.4)] transition-all duration-200 hover:bg-[#082442] hover:shadow-[0_14px_28px_-5px_rgba(11,47,91,0.5)] hover:-translate-y-0.5 sm:text-[16px]"
            >
              Hire Talent
            </Link>
            <Link
              to="/candidate-jobs"
              className="inline-flex items-center justify-center rounded-full border border-[#cbd5e1] bg-white/80 backdrop-blur-sm px-8 py-3.5 text-[15px] font-semibold text-[#1e293b] shadow-sm transition-all duration-200 hover:border-[#0B2F5B] hover:text-[#0B2F5B] hover:bg-white hover:-translate-y-0.5 sm:text-[16px]"
            >
              Find Your Role
            </Link>
          </div>
        </div>

        <div className="relative lg:translate-x-30">
          <div className="hero-visuals relative min-h-[460px]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute right-0 top-2 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_30%_30%,#efe6ff_0%,#f7f2ff_55%,transparent_70%)] opacity-85" />
              <div className="absolute right-14 bottom-2 h-52 w-52 rounded-full bg-[radial-gradient(circle_at_50%_50%,#fff1da_0%,#f7f2ed_65%,transparent_80%)] opacity-85" />
            </div>

            <svg className="hero-path" viewBox="0 0 520 360" fill="none">
              <path
                d="M48 70C130 120 210 110 260 80C320 45 405 65 450 110C500 160 450 210 380 200C300 185 240 230 200 280C160 335 80 330 40 270"
                stroke="#d9cfc6"
                strokeWidth="2"
                strokeDasharray="5 9"
              />
            </svg>

            <div className="hero-enter-wrap hero-card-1 absolute -left-10 top-8" style={{ "--hero-delay": "0s" }}>
              <div className="float-card shake-on-hover flex items-center gap-6 overflow-hidden rounded-2xl border border-[#cfe3c8] bg-white pl-0 pr-4 pt-2 pb-0 shadow-[0_25px_45px_-35px_rgba(22,101,52,0.4)]">
                <img
                  src="https://t3.ftcdn.net/jpg/18/89/73/52/240_F_1889735296_dcEb6Df6pz4EHNw3P2KGLvPj4xsMFetm.jpg"
                  alt="Andrew Crew"
                  className="hero-card-1-photo h-36 w-36 self-end object-cover"
                />
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl border border-[#ece7f7] bg-white px-3 py-1.5">
                    <p className="text-[12px] font-semibold text-[#1f2937]">Andrew Crew</p>
                    <p className="text-[10px] text-[#6b7280]">Developer</p>
                  </div>
                  <div className="flex w-fit items-center gap-1 rounded-full bg-[#e2f3d9] px-2 py-1 text-[9px] font-semibold text-[#2f6b39]">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#9bd48e] text-[8px] text-white">
                      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none">
                        <path
                          d="M7 11.5l3 3 7-7"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    Best fit
                  </div>
                </div>
              </div>
            </div>

            <div className="float-pill hero-pill hero-pill-account absolute left-[220px] top-[360px] z-10 -rotate-6 rounded-2xl border border-[#eddcc7] bg-white px-3 py-1 text-[11px] font-semibold text-[#5b4b39] shadow-sm">
              <span className="block">Account</span>
              <span className="block">Manager</span>
            </div>

            <div className="hero-enter-wrap hero-card-2 absolute left-6 top-60" style={{ "--hero-delay": "0.2s" }}>
              <div className="float-card shake-on-hover float-delay-1 overflow-hidden rounded-3xl border border-[#cfe3c8] bg-white shadow-[0_25px_45px_-35px_rgba(22,101,52,0.4)]">
                <img
                  src="https://t3.ftcdn.net/jpg/17/69/69/00/240_F_1769690052_LK1qCQal39UbhgfJAQyRoXOrynaulF66.jpg"
                  alt="Account Manager"
                  className="hero-card-2-photo h-44 w-48 object-cover"
                />
              </div>
            </div>

            <div className="hero-enter-wrap hero-card-3 absolute right-6 top-14" style={{ "--hero-delay": "0.4s" }}>
              <div className="float-card shake-on-hover float-delay-2 w-[240px] overflow-hidden rounded-[28px] border border-[#cfe3c8] bg-white shadow-[0_25px_45px_-35px_rgba(22,101,52,0.4)]">
                <img
                  src="https://t4.ftcdn.net/jpg/11/53/92/41/240_F_1153924172_ysggsppCsRapW52HbwCS422pkIspO5UD.jpg"
                  alt="Financial specialist"
                  className="hero-card-3-photo h-80 w-full object-cover"
                />
              </div>
            </div>

            <div className="float-pill hero-pill hero-pill-finance absolute right-28 top-6 -rotate-6 rounded-full border border-[#e2d9d0] bg-white px-3 py-1 text-[11px] font-semibold text-[#1f2937] shadow-sm">
              Financial specialist
            </div>

            <div className="hero-star absolute right-[148px] top-[355px] flex h-8 w-8 items-center justify-center rounded-full border border-[#f7e0a6] bg-[#fde68a] text-[#7c5d00] shadow-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 3.5l2.6 5.26 5.8.85-4.2 4.1 1 5.8-5.2-2.74-5.2 2.74 1-5.8-4.2-4.1 5.8-.85L12 3.5z" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-4 flex max-w-7xl flex-col items-center gap-4 px-8 pb-8 text-center">
        <p className="section-label">Trusted by 100+ Business Partner</p>
        <div className="logo-row flex flex-wrap items-center justify-center gap-8 text-sm tracking-wide text-[#1f2937]">
          {logos.map((logo) => (
            <span key={logo}>{logo}</span>
          ))}
        </div>
      </section>
    </main>
  );
}
