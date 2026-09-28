import { Route, Routes } from "react-router-dom";
import Header from "./Component/Header.jsx";
import Hero from "./Component/Hero.jsx";
import SpecializationRole from "./Component/SpecializationRole.jsx";
import TalentBridgeWorks from "./Component/TalentBridgeWorks.tsx";
import WhyChooseUs from "./Component/WhyChooseUs.jsx";
import BigCard from "./Component/BigCard.tsx";
import JobBoard from "./Component/JobBoard.tsx";
import ReadyToHire from "./Component/ReadyToHire.tsx";
import Footer from "./Component/Footer.tsx";
import CandidateJob from "./pages/CandidateJob.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import Employee from "./pages/Employee.jsx";
import ContactUs from "./pages/ContactUs.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminLayout from "./pages/AdminLayout.jsx";
import AdminRoute from "./Component/AdminRoute.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminJobListings from "./pages/admin/AdminJobListings.jsx";
import AdminCandidates from "./pages/admin/AdminCandidates.jsx";
import AdminCVUpload from "./pages/admin/AdminCVUpload.jsx";
import AdminApplicants from "./pages/admin/AdminApplicants.jsx";
import CandidateDetail from "./pages/admin/CandidateDetail.jsx";
import AdminShortlisted from "./pages/admin/AdminShortlisted.jsx";
import AdminClients from "./pages/admin/AdminClients.jsx";
import AdminClientJobs from "./pages/admin/AdminClientJobs.jsx";
import AdminClientJobDetail from "./pages/admin/AdminClientJobDetail.jsx";
import AdminEmailAutomation from "./pages/admin/AdminEmailAutomation.jsx";
import AdminManagement from "./pages/admin/AdminManagement.jsx";

import AdminHRReports from "./pages/admin/AdminHRReports.jsx";
import AdminEmployerRequirements from "./pages/admin/AdminEmployerRequirements.jsx";
import AdminContactMessages from "./pages/admin/AdminContactMessages.jsx";
import SuperAdminOnly from "./Component/SuperAdminOnly.jsx";

function HomePage() {
  return (
    <div className="min-h-screen bg-[#f7f2ed]">
      <Header />
      <Hero />
      <SpecializationRole />
      <WhyChooseUs />
      <TalentBridgeWorks />
      <BigCard />
      <JobBoard />
      <ReadyToHire />
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/candidate-jobs" element={<CandidateJob />} />
      <Route path="/job/:id" element={<JobDetail />} />
      <Route path="/employers" element={<Employee />} />
      <Route path="/contact" element={<ContactUs />} />

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="jobs" element={<AdminJobListings />} />
        <Route path="candidates" element={<AdminCandidates />} />
        <Route path="cv-upload" element={<AdminCVUpload />} />
        <Route path="applicants" element={<AdminApplicants />} />
        <Route path="applicants/:id" element={<CandidateDetail />} />
        <Route path="shortlisted" element={<AdminShortlisted />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="client-jobs" element={<AdminClientJobs />} />
        <Route path="client-jobs/:jobCode" element={<AdminClientJobDetail />} />
        <Route path="client-jobs/:jobCode/email" element={<AdminEmailAutomation />} />
        <Route path="employer-requirements" element={<AdminEmployerRequirements />} />
        <Route path="contact-messages" element={<AdminContactMessages />} />
        <Route
          path="admin-management"
          element={
            <SuperAdminOnly pageName="Admin Management">
              <AdminManagement />
            </SuperAdminOnly>
          }
        />
        <Route
          path="hr-reports"
          element={
            <SuperAdminOnly pageName="HR Reports">
              <AdminHRReports />
            </SuperAdminOnly>
          }
        />
      </Route>
    </Routes>
  );
}
