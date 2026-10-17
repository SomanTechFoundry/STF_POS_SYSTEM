import { useEffect, useState } from "react";
import AppRouter from "./app/AppRouter";
import { SESSION_NOTICE_KEY } from "./api/client";

function App() {
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_NOTICE_KEY);
    if (stored) {
      setNotice(stored);
      sessionStorage.removeItem(SESSION_NOTICE_KEY);
    }
  }, []);

  return (
    <>
      {notice && (
        <div className="session-notice" role="alert">
          <span>{notice}</span>
          <button type="button" className="ghost" onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}
      <AppRouter />
    </>
  );
}

export default App;
