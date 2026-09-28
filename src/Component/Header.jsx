import { Link, useNavigate } from "react-router-dom";

const navItems = [
  { label: "Home" },
  { label: "For Employers" },
  { label: "For Candidates" },
  { label: "Contact us" },
];

export default function Header() {
  const navigate = useNavigate();

  return (
    <header className="absolute inset-x-0 top-0 z-50 bg-transparent">
      <div className="relative mx-auto flex h-28 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center -ml-1 sm:-ml-3 transition-opacity hover:opacity-95"
        >
          <img
            src="/7d9e2a6b-1a4b-4373-88c7-4c2781cdaf0d (1).png"
            alt="Ciedeck"
            className="h-[74px] w-auto object-contain"
            loading="lazy"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-[15px] font-medium text-[#4b5563] lg:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2">
          {navItems.map((item) => {
            const content = (
              <>
                <span>{item.label}</span>
                {item.hasCaret && (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </>
            );

            if (item.label === "For Candidates") {
              return (
                <Link key={item.label} to="/candidate-jobs" className="flex items-center gap-1 transition-colors duration-200 hover:text-[#0B2F5B]">
                  {content}
                </Link>
              );
            }
            if (item.label === "For Employers") {
              return (
                <Link key={item.label} to="/employers" className="flex items-center gap-1 transition-colors duration-200 hover:text-[#0B2F5B]">
                  {content}
                </Link>
              );
            }
            if (item.label === "Home") {
              return (
                <Link key={item.label} to="/" className="flex items-center gap-1 transition-colors duration-200 hover:text-[#0B2F5B]">
                  {content}
                </Link>
              );
            }
            if (item.label === "Contact us") {
              return (
                <Link key={item.label} to="/contact" className="flex items-center gap-1 transition-colors duration-200 hover:text-[#0B2F5B]">
                  {content}
                </Link>
              );
            }
            return (
              <button key={item.label} type="button" className="flex items-center gap-1 transition-colors duration-200 hover:text-[#0B2F5B]">
                {content}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => navigate("/admin/login")}
          className="rounded-full border border-[#d1c6bd] bg-white/60 px-6 py-2.5 text-sm font-semibold text-[#111827] shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-[#0B2F5B] hover:bg-[#0B2F5B] hover:text-white hover:shadow"
        >
          Log In
        </button>
      </div>
    </header>
  );
}
