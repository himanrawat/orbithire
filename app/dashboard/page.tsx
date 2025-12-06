import { NavBar } from "@/components/NavBar";

const sampleFolders = [
  { company: "Google", resumes: 2, coverLetters: 1, notes: 1, status: "Applied" },
  { company: "Bosch", resumes: 1, coverLetters: 1, notes: 2, status: "Saved" }
];

const quickActions = [
  "Paste JD to tailor resume + cover letter",
  "Upload PDF/Word and fill profile",
  "Add HR note to a company folder",
  "Send 7-day follow-up"
];

export default function DashboardPage() {
  const user = { name: "You", avatarUrl: undefined };

  return (
    <div className="page">
      <NavBar user={user} />

      <section className="section">
        <h2>Dashboard</h2>
        <p className="muted">Track your pipeline, manage company folders, and spin up tailored docs fast.</p>
      </section>

      <section className="section two-col">
        <div className="card">
          <h3>Profile completeness</h3>
          <p className="muted">Upload a resume to pre-fill, then tweak your profile separately.</p>
          <div className="pill-row">
            <span className="pill">Skills: 70%</span>
            <span className="pill">Experience: 100%</span>
            <span className="pill">Photo: needed (DE/EU)</span>
          </div>
          <a className="button primary" href="/profile">
            Complete profile
          </a>
        </div>

        <div className="card">
          <h3>Quick actions</h3>
          <ul className="list">
            {quickActions.map((action) => (
              <li className="list-item" key={action}>
                {action}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <h2>Company folders</h2>
        <div className="card-grid">
          {sampleFolders.map((folder) => (
            <div className="card" key={folder.company}>
              <h3>{folder.company}</h3>
              <p className="muted">
                {folder.resumes} resume(s) · {folder.coverLetters} cover letter(s) · {folder.notes} note(s)
              </p>
              <div className="pill-row">
                <span className="pill">Status: {folder.status}</span>
                <span className="pill">Add HR note</span>
              </div>
              <div className="cta-row">
                <a className="button" href={`/companies/${folder.company.toLowerCase()}/upload`}>
                  Add resume/CL
                </a>
                <a className="button primary" href={`/companies/${folder.company.toLowerCase()}`}>
                  Open folder
                </a>
              </div>
            </div>
          ))}
          <div className="card">
            <h3>Create a company folder</h3>
            <p className="muted">Keep every JD, resume, cover letter, and HR note organized per company.</p>
            <a className="button primary" href="/companies/new">
              New folder
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
