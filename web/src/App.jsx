import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Placeholder } from './pages/Placeholder.jsx';

// Router scaffold: a public / protected split with a single placeholder route on each side.
// Real routes (grouped by role under pages/<role>/) and real layouts get added per module.
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* --- Public --- */}
        <Route path="/" element={<Placeholder title="Public area — placeholder" />} />

        {/* --- Protected (auth gate is UX only; server re-checks every request) --- */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<Placeholder title="Protected area — placeholder" />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
