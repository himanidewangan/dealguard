import { useState } from "react";
import { isLoggedIn, loginConfigured, logout, tryLogin } from "../../src/session.ts";
import Dashboard from "./Dashboard.tsx";

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn);
  if (authed) {
    return <Dashboard onLogout={() => { logout(); setAuthed(false); }} />;
  }
  return <Login onSuccess={() => setAuthed(true)} />;
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tryLogin(email, password)) onSuccess();
    else setError("That email or password is not right. Check both and try again.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-card bg-card p-6" aria-labelledby="login-h">
        <h1 id="login-h" className="font-mono text-xl font-bold">DealGuard dashboard</h1>
        {!loginConfigured ? (
          <p role="alert" className="text-sm text-butter">Login is not set up in this build. Set WXT_DASHBOARD_EMAIL and WXT_DASHBOARD_PASSWORD, then build again.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 rounded-input border border-line bg-well px-4 font-mono text-[13px] text-text" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="label">Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-11 rounded-input border border-line bg-well px-4 font-mono text-[13px] text-text" />
            </div>
            {error && <p role="alert" className="text-sm text-butter">{error}</p>}
            <button id="login" type="submit" className="btn bg-mint text-ink">Sign in</button>
          </>
        )}
        <p className="text-xs text-muted">This sign-in keeps casual users out of the page. The values are stored in the extension build, so it does not protect your history from someone with access to this browser profile.</p>
      </form>
    </main>
  );
}
