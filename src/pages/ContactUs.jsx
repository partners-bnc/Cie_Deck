import { useState } from "react";
import Header from "../Component/Header.jsx";
import Footer from "../Component/Footer.tsx";
import { jobService } from "../services/jobService.js";

const contactOptions = [
  {
    id: 1,
    title: "Employer Enquiries",
    description: "Discuss hiring needs, role requirements, and timelines.",
    email: "employers@bncglobal.com",
    phone: "+91 9876543211"
  },
  {
    id: 2,
    title: "Candidate Support",
    description: "Get help with applications, interviews, and updates.",
    email: "candidates@bncglobal.com",
    phone: "+91 9876543210"
  },
  {
    id: 3,
    title: "General Assistance",
    description: "Partnerships, queries, and other requests.",
    email: "hello@bncglobal.com",
    phone: "+91 9876543212"
  }
];

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F7F1EC",
    paddingTop: "96px",
    fontFamily: "Inter, sans-serif"
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "0 24px 48px"
  },
  hero: {
    textAlign: "center",
    padding: "40px 0 30px"
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
  fullWidthCard: {
    width: "calc(100vw - 32px)",
    borderRadius: "28px",
    padding: "54px 24px",
    background:
      "radial-gradient(circle at top, rgba(255,255,255,0.9), rgba(247,241,236,0.95)), linear-gradient(135deg, #fff7f0 0%, #f3e8dd 45%, #f7f1ec 100%)",
    border: "1px solid #eadfd6",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
    marginBottom: "40px",
    marginLeft: "50%",
    transform: "translateX(-50%)",
    position: "relative",
    overflow: "hidden"
  },
  bubbleLeft: {
    position: "absolute",
    top: "-5px",
    left: "-170px",
    width: "280px",
    height: "310px",
    borderRadius: "50%",
    background: "#E5E0F0",
    opacity: 0.9,
    zIndex: 1,
    pointerEvents: "none"
  },
  bubbleRight: {
    position: "absolute",
    top: "-5px",
    right: "-170px",
    width: "280px",
    height: "310px",
    borderRadius: "50%",
    background: "#F0E5E0",
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
  title: {
    fontSize: "46px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 12px"
  },
  subtitle: {
    fontSize: "18px",
    color: "#6b7280",
    margin: "0 auto",
    maxWidth: "720px",
    lineHeight: 1.6
  },
  split: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)",
    gap: "32px",
    alignItems: "stretch",
    marginTop: "32px"
  },
  panel: {
    background: "#ffffff",
    borderRadius: "22px",
    padding: "28px",
    border: "1px solid #eadfd6",
    boxShadow: "0 12px 26px rgba(15, 23, 42, 0.08)"
  },
  sectionTitle: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 16px"
  },
  contactGrid: {
    display: "grid",
    gap: "18px"
  },
  contactCard: {
    border: "1px solid #efe5db",
    borderRadius: "18px",
    padding: "18px",
    background: "#fffaf6"
  },
  contactTitle: {
    fontSize: "17px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 6px"
  },
  contactDescription: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "0 0 12px",
    lineHeight: 1.5
  },
  contactMeta: {
    fontSize: "14px",
    color: "#0B2F5B",
    fontWeight: 600,
    margin: "0 0 4px"
  },
  form: {
    display: "grid",
    gap: "14px"
  },
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px"
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
    minHeight: "140px",
    resize: "vertical"
  },
  submit: {
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
    marginTop: "4px"
  }
};

export default function ContactUs() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await jobService.submitContactMessage(formData);
      setSubmitted(true);
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
      setTimeout(() => setSubmitted(false), 6000);
    } catch (err) {
      console.error("Error submitting contact message:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <Header />

      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.fullWidthCard}>
            <div style={styles.bubbleLeft}></div>
            <div style={styles.bubbleRight}></div>
            <div style={styles.fullWidthInner}>
              <span style={styles.heroTag}>Support</span>
              <h1 style={styles.title}>Contact Us</h1>
              <p style={styles.subtitle}>
                Whether you are an employer or a candidate, our team is ready to help.
                Share your details and we will respond promptly.
              </p>
            </div>
          </div>
        </div>

        <div style={styles.split}>
          <div style={styles.panel}>
            <h2 style={styles.sectionTitle}>Reach the Right Team</h2>
            <div style={styles.contactGrid}>
              {contactOptions.map((item) => (
                <div key={item.id} style={styles.contactCard}>
                  <h3 style={styles.contactTitle}>{item.title}</h3>
                  <p style={styles.contactDescription}>{item.description}</p>
                  <p style={styles.contactMeta}>{item.email}</p>
                  <p style={styles.contactMeta}>{item.phone}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.sectionTitle}>Send a Message</h2>
            <form style={styles.form} onSubmit={handleSubmit}>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Full Name</label>
                  <input style={styles.input} type="text" placeholder="Your name" required value={formData.fullName} onChange={handleChange("fullName")} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input style={styles.input} type="email" placeholder="you@email.com" required value={formData.email} onChange={handleChange("email")} />
                </div>
              </div>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Phone</label>
                  <input style={styles.input} type="tel" placeholder="+91 90000 00000" value={formData.phone} onChange={handleChange("phone")} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Subject</label>
                  <input style={styles.input} type="text" placeholder="Hiring, support, or other" value={formData.subject} onChange={handleChange("subject")} />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Message</label>
                <textarea
                  style={styles.textarea}
                  placeholder="Tell us how we can help"
                  required
                  value={formData.message}
                  onChange={handleChange("message")}
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
                  Message submitted successfully! Our team will contact you shortly.
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...styles.submit,
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? "not-allowed" : "pointer"
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = "#0a2a52";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = "#0B2F5B";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                {submitting ? "Submitting..." : "Submit Message"}
              </button>
              <p style={styles.note}>We typically reply within 24 business hours.</p>
            </form>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
