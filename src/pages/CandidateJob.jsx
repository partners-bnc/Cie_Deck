import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../Component/Header.jsx";
import Footer from "../Component/Footer.tsx";
import { jobService } from "../services/jobService.js";

const filterGroups = [
  {
    title: "Format",
    options: ["Full-time", "Part time", "Hybrid", "Remote", "Office", "Internship"],
  },
  {
    title: "Experience",
    options: [
      "No Experience",
      "1 year",
      "2 years",
      "3 years",
      "4 years",
      "5 years",
      "6 years",
      "7 years",
      "8 years",
      "9 years",
      "10+ years",
    ],
  },
];

const styles = {
  page: { padding: "96px 24px 70px", fontFamily: "Inter, sans-serif", position: "relative", zIndex: 2 },
  shell: { maxWidth: "1240px", margin: "0 auto" },
  hero: { textAlign: "center", padding: "18px 0 8px" },
  title: {
    margin: "0 0 10px",
    fontSize: "48px",
    fontWeight: 600,
    lineHeight: "1.08",
    color: "#1f2937",
  },
  subtitle: {
    margin: "0 auto 18px",
    fontSize: "18px",
    color: "#6b7280",
    maxWidth: "620px",
    lineHeight: 1.6,
    whiteSpace: "nowrap",
    transform: "translateX(-45px)",
  },
  search: { display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" },
  searchInput: {
    width: "min(480px, 100%)",
    borderRadius: "999px",
    border: "1px solid #e5dfd8",
    padding: "12px 18px",
    fontSize: "14px",
    outline: "none",
    background: "#ffffff",
  },
  searchButton: {
    borderRadius: "999px",
    border: "none",
    padding: "12px 22px",
    background: "#0B2F5B",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    gap: "20px",
    marginTop: "24px",
  },
  filter: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "22px",
    border: "1px solid #eadfd6",
    marginLeft: "-32px",
    height: "560px",
    overflow: "hidden",
  },
  filterHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  filterTitle: { margin: 0, fontSize: "14px", color: "#111827", fontWeight: 600 },
  filterClear: { fontSize: "11px", color: "#9ca3af", cursor: "pointer" },
  filterGroup: { marginTop: "12px" },
  filterGroupTitle: { fontSize: "12px", color: "#6b7280", fontWeight: 600, marginBottom: "8px" },
  filterList: { display: "flex", flexWrap: "wrap", gap: "8px" },
  chip: {
    borderRadius: "999px",
    padding: "6px 12px",
    fontSize: "11px",
    border: "1px solid #e6e1da",
    background: "#ffffff",
    color: "#6b7280",
    cursor: "pointer",
  },
  chipActive: {
    borderColor: "#9A86FF",
    background: "#ECE9FF",
    color: "#6B5BFF",
    fontWeight: 600,
  },
  applyBtn: {
    marginTop: "14px",
    width: "100%",
    borderRadius: "999px",
    padding: "10px 12px",
    border: "none",
    background: "#0B2F5B",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "12px",
    cursor: "pointer",
  },
  cards: { display: "grid", gap: "14px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
  cardsSingle: { display: "grid", gap: "14px", gridTemplateColumns: "1fr" },
  card: {
    background: "#ffffff",
    border: "1px solid #eadfd6",
    borderRadius: "18px",
    padding: "16px 18px",
    display: "grid",
    gap: "10px",
    boxShadow: "0 18px 30px -26px rgba(15, 23, 42, 0.35)",
  },
  cardTitle: { margin: 0, fontSize: "16px", color: "#111827", fontWeight: 600 },
  meta: { fontSize: "12px", color: "#6b7280", display: "flex", gap: "12px", flexWrap: "wrap" },
  metaSpan: { display: "inline-flex", gap: "6px", alignItems: "center" },
  actions: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: "10px" },
  applyJobBtn: {
    borderRadius: "999px",
    padding: "8px 14px",
    border: "1px solid #0B2F5B",
    background: "transparent",
    color: "#0B2F5B",
    fontWeight: 600,
    fontSize: "12px",
  },
};

export default function CandidateJob() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingFilters, setPendingFilters] = useState({ Format: [], Experience: [] });
  const [appliedFilters, setAppliedFilters] = useState({ Format: [], Experience: [] });
  const [pendingSalary, setPendingSalary] = useState(50);
  const [appliedSalary, setAppliedSalary] = useState(null);
  const [selectedSalaryRange, setSelectedSalaryRange] = useState(null);
  const [appliedSalaryRange, setAppliedSalaryRange] = useState(null);
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [loadingJobId, setLoadingJobId] = useState(null);
  const [isGridView, setIsGridView] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cardsLoaded, setCardsLoaded] = useState(false);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        setLoading(true);
        const fetchedJobs = await jobService.fetchJobs();
        console.log('Fetched jobs:', fetchedJobs);
        setJobs(fetchedJobs || []);
      } catch (error) {
        console.error('Failed to load jobs:', error);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    loadJobs();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setCardsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const togglePending = (groupTitle, value) => {
    setPendingFilters((prev) => {
      const current = prev[groupTitle] || [];
      const exists = current.includes(value);
      const next = exists ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, [groupTitle]: next };
    });
  };

  const handleApply = () => {
    setAppliedFilters({ ...pendingFilters });
    setAppliedSalary(pendingSalary);
    setAppliedSalaryRange(selectedSalaryRange);
  };

  const handleApplyClick = async (job) => {
    setLoadingJobId(job.id);
    try {
      // Preload complete job data
      const jobData = await jobService.fetchJobById(job.id);
      // Store in sessionStorage for instant access
      sessionStorage.setItem(`job_${job.id}`, JSON.stringify(jobData));
      // Navigate after data is fully loaded
      navigate(`/job/${job.id}`);
    } catch (error) {
      console.error('Error preloading job:', error);
      setLoadingJobId(null);
    }
  };

  const handleClear = () => {
    setPendingFilters({ Format: [], Experience: [] });
    setAppliedFilters({ Format: [], Experience: [] });
    setPendingSalary(50);
    setAppliedSalary(null);
    setSelectedSalaryRange(null);
    setAppliedSalaryRange(null);
  };

  const formatPostedDate = (job) => {
    const rawDate = job?.created_at || job?.updated_at || job?.created_date || job?.updated_date;
    if (!rawDate) return "Posted recently";

    const postDate = new Date(rawDate);
    if (isNaN(postDate.getTime())) return "Posted recently";

    const now = new Date();
    const diffMs = now.getTime() - postDate.getTime();
    if (diffMs < 0) return "Posted today";

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) return "Posted just now";
      return "Posted today";
    }

    if (diffDays > 30) {
      return "Posted 30+ days ago";
    }

    return diffDays === 1 ? "Posted 1d ago" : `Posted ${diffDays}d ago`;
  };

  const getSalaryInfo = (salaryStr) => {
    if (!salaryStr) return { min: 0, max: 0 };
    const str = salaryStr.toString().toLowerCase();
    const nums = str.match(/\d+(\.\d+)?/g);
    if (!nums) return { min: 0, max: 0 };
    const vals = nums.map(n => parseFloat(n));
    if (vals.length === 1) {
      if (str.includes('+') || str.includes('above') || str.includes('more')) {
        return { min: vals[0], max: 999 };
      }
      if (str.includes('up to') || str.includes('upto') || str.includes('max')) {
        return { min: 0, max: vals[0] };
      }
      return { min: vals[0], max: vals[0] };
    }
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };

  const filteredJobs = jobs.filter(job => {
    if (!job) return false;
    
    const matchesSearch = searchQuery === "" || 
      (job.title && job.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.location && job.location.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFormat = appliedFilters.Format.length === 0 ||
      appliedFilters.Format.includes(job.type);
    
    const matchesExperience = appliedFilters.Experience.length === 0 ||
      appliedFilters.Experience.some(selectedExp => {
        const jobExpStr = (job.experience || "").toLowerCase();
        if (selectedExp === "No Experience") {
          return jobExpStr.includes("no") || jobExpStr.includes("0") || jobExpStr.includes("fresher");
        }
        const selectedYears = parseInt(selectedExp.match(/\d+/)?.[0] || 0);
        const jobMinYearsMatch = jobExpStr.match(/\d+(\.\d+)?/);
        if (!jobMinYearsMatch) return false;
        const jobMinYears = parseFloat(jobMinYearsMatch[0]);
        return selectedYears >= jobMinYears;
      });
    
    const jobSal = getSalaryInfo(job.salary);
    let matchesSalary = true;

    if (appliedSalaryRange) {
       const rangeSal = getSalaryInfo(appliedSalaryRange);
       matchesSalary = (jobSal.min <= rangeSal.max && jobSal.max >= rangeSal.min);
    } else if (appliedSalary !== null && appliedSalary !== 50) {
       matchesSalary = jobSal.min <= appliedSalary;
    }
    
    return matchesSearch && matchesFormat && matchesExperience && matchesSalary;
  });

  const hasAnyFilters = pendingFilters.Format.length > 0 || pendingFilters.Experience.length > 0 || selectedSalaryRange !== null || pendingSalary !== 50;

  return (
    <div className="min-h-screen" style={{backgroundColor: '#F7F1EC', position: 'relative', overflowX: 'hidden', width: '100%'}}>
      <div style={{
        position: 'absolute', top: '70px', left: '-170px', width: '280px', height: '250px',
        borderRadius: '50%', background: '#E5E0F0', opacity: 0.6, zIndex: 1, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '120px', right: '-220px', width: '400px', height: '350px',
        borderRadius: '50%', background: '#E5E0F0', opacity: 0.6, zIndex: 1, pointerEvents: 'none'
      }} />
      <Header />
      <section style={{...styles.page, width: '100%', maxWidth: '100vw', overflowX: 'hidden'}}>
        <div style={{...styles.shell, width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '0 24px'}}>
          <div style={styles.hero}>
            <h1 style={styles.title}>Find work that means more</h1>
            <p style={styles.subtitle}>
              Discover roles that align with your values, skills, and the change you want to make.
            </p>
            <div style={styles.search}>
              <input 
                style={styles.searchInput} 
                placeholder="Search by role or keyword" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="button" style={styles.searchButton}>Search</button>
            </div>
          </div>

          <div style={styles.grid}>
            <aside style={styles.filter}>
              <div style={styles.filterHeader}>
                <h3 style={styles.filterTitle}>Filters</h3>
                {hasAnyFilters && (
                  <span style={styles.filterClear} onClick={handleClear}>Clear all x</span>
                )}
              </div>
              {filterGroups.map((group) => (
                <div key={group.title} style={styles.filterGroup}>
                  <div style={styles.filterGroupTitle}>{group.title}</div>
                  <div style={styles.filterList}>
                    {group.options.map((item) => {
                      const isActive = pendingFilters[group.title]?.includes(item);
                      return (
                        <span
                          key={item}
                          onClick={() => togglePending(group.title, item)}
                          style={{
                            ...styles.chip,
                            ...(isActive ? styles.chipActive : {}),
                          }}
                        >
                          {item}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{marginTop: '14px'}}>
                <div style={styles.filterGroupTitle}>Salary</div>
                <div style={{fontSize: '11px', color: '#6b7280', marginBottom: '6px'}}>
                  ₹0L - ₹{pendingSalary}L
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={pendingSalary}
                  onChange={(event) => setPendingSalary(Number(event.target.value))}
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '3px',
                    background: `linear-gradient(to right, #9A86FF 0%, #9A86FF ${(pendingSalary / 50) * 100}%, #ece7f7 ${(pendingSalary / 50) * 100}%, #ece7f7 100%)`,
                    outline: 'none',
                    WebkitAppearance: 'none',
                    cursor: 'pointer'
                  }}
                />
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #9A86FF;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                  }
                  input[type="range"]::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #9A86FF;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                  }
                `}</style>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px'}}>
                  {['2-5L', '5-7L', '7-10L', '10-15L', '15-20L', '20+L'].map((range) => {
                    const isSelected = selectedSalaryRange === range;
                    return (
                      <span
                        key={range}
                        onClick={() => setSelectedSalaryRange(isSelected ? null : range)}
                        style={{
                          ...styles.chip,
                          fontSize: '10px',
                          padding: '4px 8px',
                          ...(isSelected ? styles.chipActive : {})
                        }}
                      >
                        ₹{range}
                      </span>
                    );
                  })}
                </div>
              </div>
              <button type="button" style={styles.applyBtn} onClick={handleApply}>
                Apply filter
              </button>
            </aside>

            <div>
              <div style={{marginBottom: '16px', padding: '0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={{margin: 0, fontSize: '18px', color: '#111827', fontWeight: 600}}>
                  All Jobs({filteredJobs.length})
                </h3>
                <div style={{display: 'flex', border: '1px solid #e5dfd8', borderRadius: '6px', overflow: 'hidden'}}>
                  <button onClick={() => setIsGridView(true)} style={{
                    background: isGridView ? '#ffffff' : '#f9f9f9', border: 'none', padding: '6px 8px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRight: '1px solid #e5dfd8'
                  }}>
                    <svg width="16" height="16" fill={isGridView ? '#6B5BFF' : '#6b7280'} viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                  </button>
                  <button onClick={() => setIsGridView(false)} style={{
                    background: !isGridView ? '#ffffff' : '#f9f9f9', border: 'none', padding: '6px 8px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="16" height="16" fill={!isGridView ? '#6B5BFF' : '#6b7280'} viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="4" rx="1"/>
                      <rect x="3" y="10" width="18" height="4" rx="1"/>
                      <rect x="3" y="16" width="18" height="4" rx="1"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div style={isGridView ? styles.cards : styles.cardsSingle}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '18px', color: '#666' }}>Loading jobs...</div>
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '18px', color: '#666' }}>No jobs found</div>
                  </div>
                ) : (
                  filteredJobs.map((job, index) => {
                    if (!job || !job.title) return null;
                    
                    const isApplied = appliedJobs.has(job.title);
                    const isHovered = hoveredCard === job.title;
                    const isButtonHovered = hoveredButton === job.title;
                  
                    return (
                      <article 
                        key={job.id || job.title} 
                        style={{
                          ...styles.card,
                          borderColor: isApplied ? '#9A86FF' : (isHovered ? '#d1c6bd' : '#eadfd6'),
                          transform: `translateY(${cardsLoaded ? (isHovered ? '-2px' : '0') : '50px'})`,
                          opacity: cardsLoaded ? 1 : 0,
                          transition: `all ${cardsLoaded ? '0.3s' : '0.5s'} ease`,
                          transitionDelay: cardsLoaded ? '0s' : `${index * 0.15}s`,
                          boxShadow: isHovered ? '0 20px 35px -20px rgba(15, 23, 42, 0.4)' : '0 18px 30px -26px rgba(15, 23, 42, 0.35)'
                        }}
                        onMouseEnter={() => setHoveredCard(job.title)}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        <h4 style={styles.cardTitle}>{job.title}</h4>
                        <div style={styles.meta}>
                          <span style={styles.metaSpan}>
                            <svg width="12" height="12" fill="#6b7280" viewBox="0 0 24 24">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            {job.location || 'Location TBD'}
                          </span>
                          <span style={styles.metaSpan}>
                            <svg width="12" height="12" fill="#6b7280" viewBox="0 0 24 24">
                              <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
                            </svg>
                            {job.type || 'Type TBD'}
                          </span>
                          <span style={styles.metaSpan}>
                            <svg width="12" height="12" fill="#6b7280" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                            {job.experience || 'Experience TBD'}
                          </span>
                        </div>
                        <div style={styles.meta}>
                          <span style={styles.metaSpan}>
                            <svg width="13" height="13" fill="none" stroke="#6b7280" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4 4 0 0 0 0-8" />
                            </svg>
                            {job.salary || 'Salary TBD'}
                          </span>
                        </div>
                        <div style={styles.actions}>
                          <span style={{ ...styles.meta, fontSize: "11px", color: "#6b7280" }}>
                            {formatPostedDate(job)}
                          </span>
                          <button 
                            onClick={() => handleApplyClick(job)}
                            disabled={loadingJobId === job.id}
                            style={{
                              ...styles.applyJobBtn,
                              background: isApplied ? '#6B5BFF' : (isButtonHovered ? '#f0f0ff' : 'transparent'),
                              color: isApplied ? '#ffffff' : (isButtonHovered ? '#6B5BFF' : '#0B2F5B'),
                              borderColor: isApplied ? '#6B5BFF' : (isButtonHovered ? '#6B5BFF' : '#0B2F5B'),
                              transform: isButtonHovered ? 'scale(1.05)' : 'scale(1)',
                              transition: 'all 0.2s ease',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              opacity: loadingJobId === job.id ? 0.7 : 1,
                              cursor: loadingJobId === job.id ? 'not-allowed' : 'pointer'
                            }}
                            onMouseEnter={() => setHoveredButton(job.title)}
                            onMouseLeave={() => setHoveredButton(null)}
                          >
                            {loadingJobId === job.id ? (
                              <>
                                <div style={{
                                  width: '12px', height: '12px', border: '2px solid currentColor',
                                  borderTop: '2px solid transparent', borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }}></div>
                                Loading...
                              </>
                            ) : (
                              isApplied ? 'Applied' : 'Apply now'
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
