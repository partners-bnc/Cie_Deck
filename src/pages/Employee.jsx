import { useState } from "react";
import Header from "../Component/Header.jsx";
import Footer from "../Component/Footer.tsx";
import { jobService } from "../services/jobService.js";

const highlights = [
  {
    id: 1,
    title: "Role-Specific Hiring",
    description: "Share your requirement and we map the best-fit candidates fast."
  },
  {
    id: 2,
    title: "Verified Talent Pool",
    description: "Screened profiles across IT, Sales, Operations, and more."
  },
  {
    id: 3,
    title: "Dedicated Hiring Support",
    description: "One point of contact for shortlisting, interviews, and offer closure."
  },
  {
    id: 4,
    title: "Fast Turnaround",
    description: "Quick shortlists with clear communication at every hiring stage."
  }
];

const contactCards = [
  {
    id: 1,
    name: "HR Department",
    role: "General Inquiries",
    phone: "+91 9876543210",
    description: "For job applications and general queries"
  },
  {
    id: 2,
    name: "Recruitment Team",
    role: "Job Opportunities",
    phone: "+91 9876543211",
    description: "For specific job openings and interviews"
  },
  {
    id: 3,
    name: "Technical Support",
    role: "IT Support",
    phone: "+91 9876543212",
    description: "For technical assistance and support"
  }
];

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: '#F7F1EC',
    paddingTop: "96px",
    fontFamily: "Inter, sans-serif"
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "0 24px 40px"
  },
  fullWidthCard: {
    width: "calc(100vw - 32px)",
    borderRadius: "28px",
    padding: "54px 24px",
    background:
      "radial-gradient(circle at top, rgba(255,255,255,0.9), rgba(247,241,236,0.95)), linear-gradient(135deg, #fff7f0 0%, #f3e8dd 45%, #f7f1ec 100%)",
    border: "1px solid #eadfd6",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
    marginBottom: "48px",
    marginLeft: "50%",
    transform: "translateX(-50%)",
    position: "relative",
    overflow: "hidden"
  },
  bubbleLeft: {
    position: "absolute",
    top: "-5px",
    left: "-150px",
    width: "280px",
    height: "352px",
    borderRadius: "50%",
    background: "#E5E0F0",
    opacity: 0.9,
    zIndex: 1,
    pointerEvents: "none"
  },
  bubbleRight: {
    position: "absolute",
    top: "-5px",
    right: "-150px",
    width: "280px",
    height: "352px",
    borderRadius: "50%",
    background: "#E5E0F0",
    opacity: 0.9,
    zIndex: 1,
    pointerEvents: "none"
  },
  fullWidthInner: {
    maxWidth: "900px",
    margin: "0 auto",
    textAlign: "center",
    position: "relative",
    zIndex: 2
  },
  header: {
    textAlign: "center"
  },
  title: {
    fontSize: "52px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 16px"
  },
  subtitle: {
    fontSize: "18px",
    color: "#6b7280",
    margin: "0 auto",
    maxWidth: "760px",
    lineHeight: 1.6
  },
  heroTag: {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: "999px",
    background: "#0B2F5B",
    color: "#fff",
    fontSize: "12px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontWeight: 600,
    marginBottom: "16px"
  },
  splitSection: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
    gap: "32px",
    alignItems: "stretch"
  },
  panel: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    border: "1px solid #eadfd6",
    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.08)"
  },
  sectionTitle: {
    fontSize: "28px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 12px"
  },
  sectionText: {
    fontSize: "15px",
    color: "#4b5563",
    lineHeight: 1.6,
    margin: "0 0 20px"
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
    gap: "24px",
    marginTop: "24px"
  },
  card: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "32px",
    border: "1px solid #eadfd6",
    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.08)",
    transition: "all 0.3s ease"
  },
  cardName: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#333",
    margin: "0 0 8px"
  },
  cardDescription: {
    fontSize: "14px",
    color: "#666",
    margin: "0 0 24px",
    lineHeight: 1.5
  },
  form: {
    display: "grid",
    gap: "14px"
  },
  field: {
    display: "grid",
    gap: "6px"
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151"
  },
  input: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    outline: "none"
  },
  textarea: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    outline: "none",
    minHeight: "120px",
    resize: "vertical"
  },
  submitButton: {
    padding: "14px 20px",
    background: "#0B2F5B",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s ease"
  },
  note: {
    fontSize: "12px",
    color: "#6b7280",
    marginTop: "6px"
  },
  contactSection: {
    marginTop: "56px",
    paddingBottom: "24px"
  },
  contactTitle: {
    fontSize: "26px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 8px"
  },
  contactSubtitle: {
    fontSize: "15px",
    color: "#6b7280",
    margin: "0 0 24px"
  },
  contactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "24px"
  },
  contactCard: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "28px",
    border: "1px solid #eadfd6",
    boxShadow: "0 12px 26px rgba(15, 23, 42, 0.08)"
  },
  contactName: {
    fontSize: "22px",
    fontWeight: 600,
    color: "#333",
    margin: "0 0 8px"
  },
  contactRole: {
    fontSize: "15px",
    color: "#0B2F5B",
    fontWeight: 500,
    margin: "0 0 12px"
  },
  contactDescription: {
    fontSize: "14px",
    color: "#666",
    margin: "0 0 24px",
    lineHeight: 1.5
  },
  contactButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    width: "100%",
    padding: "14px 18px",
    background: "#0B2F5B",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s ease"
  }
};

export default function Employee() {
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    requirement: "",
    positions: "",
    details: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleCall = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await jobService.submitEmployerRequirement(formData);
      setSubmitted(true);
      setFormData({
        companyName: "",
        contactPerson: "",
        email: "",
        phone: "",
        requirement: "",
        positions: "",
        details: "",
      });
      setTimeout(() => setSubmitted(false), 6000);
    } catch (err) {
      console.error("Error submitting employer requirement:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <Header />
      
      <div style={styles.container}>
        <div style={styles.fullWidthCard}>
          <div style={styles.bubbleLeft}></div>
          <div style={styles.bubbleRight}></div>
          <div style={styles.fullWidthInner}>
            <div style={styles.header}>
              <span style={styles.heroTag}>Employers</span>
          <h1 style={styles.title}>Hire From Us</h1>
          <p style={styles.subtitle}>
            We recruit across roles and quickly connect you with the right candidates.
            We also support international hiring for the Middle East, South Africa,
            Australia, Canada, the UK, and more.
          </p>
            </div>
          </div>
        </div>

        <div style={styles.splitSection}>
          <div style={styles.panel}>
            <h2 style={styles.sectionTitle}>Why Employers Work With Us</h2>
            <p style={styles.sectionText}>
              From entry-level to senior roles, we actively source candidates across
              industries. Tell us what you need and we will shortlist candidates who
              match your skills, budget, and timeline.
            </p>
            <div style={styles.cardsGrid}>
              {highlights.map((item) => (
                <div 
                  key={item.id} 
                  style={styles.card}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 10px 28px rgba(0, 0, 0, 0.08)';
                  }}
                >
                  <h3 style={styles.cardName}>{item.title}</h3>
                  <p style={styles.cardDescription}>{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.sectionTitle}>Share Your Requirement</h2>
            <p style={styles.sectionText}>
              Fill the form and our recruitment team will contact you shortly.
            </p>
            <form style={styles.form} onSubmit={handleSubmit}>
              <div style={styles.field}>
                <label style={styles.label}>Company Name</label>
                <input style={styles.input} type="text" placeholder="Your company" required value={formData.companyName} onChange={handleChange("companyName")} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Contact Person</label>
                <input style={styles.input} type="text" placeholder="Your full name" required value={formData.contactPerson} onChange={handleChange("contactPerson")} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input style={styles.input} type="email" placeholder="you@company.com" required value={formData.email} onChange={handleChange("email")} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Phone</label>
                <input style={styles.input} type="tel" placeholder="+91 90000 00000" required value={formData.phone} onChange={handleChange("phone")} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Role / Requirement</label>
                <input style={styles.input} type="text" placeholder="Role, experience, location" required value={formData.requirement} onChange={handleChange("requirement")} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Number of Positions</label>
                <input style={styles.input} type="number" min="1" placeholder="e.g. 3" required value={formData.positions} onChange={handleChange("positions")} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Additional Details</label>
                <textarea
                  style={styles.textarea}
                  placeholder="Skills, budget, joining timeline, interview process"
                  value={formData.details}
                  onChange={handleChange("details")}
                />
              </div>
              {submitted && (
                <div style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#065f46",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Requirement submitted successfully! Our team will contact you shortly.
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...styles.submitButton,
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? "not-allowed" : "pointer"
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = '#0a2a52';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = '#0B2F5B';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {submitting ? "Submitting..." : "Submit Requirement"}
              </button>
              <p style={styles.note}>
                We typically respond within 24 business hours.
              </p>
            </form>
          </div>
        </div>

        <div style={styles.contactSection}>
          <h2 style={styles.contactTitle}>Contact Our Team</h2>
          <p style={styles.contactSubtitle}>
            Reach the right team quickly for hiring support and employer inquiries.
          </p>
          <div style={styles.contactGrid}>
            {contactCards.map((contact) => (
              <div key={contact.id} style={styles.contactCard}>
                <h3 style={styles.contactName}>{contact.name}</h3>
                <p style={styles.contactRole}>{contact.role}</p>
                <p style={styles.contactDescription}>{contact.description}</p>
                <button
                  onClick={() => handleCall(contact.phone)}
                  style={styles.contactButton}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#0a2a52';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#0B2F5B';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  {contact.phone}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
