import { lazy, Suspense } from "react";
import { MemoryRouter as BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Library from "@/pages/Library";
import Favorites from "@/pages/Favorites";
import RecentlyPlayedPage from "@/pages/RecentlyPlayed";

const Stats = lazy(() => import("@/pages/Stats"));
const Settings = lazy(() => import("@/pages/Settings"));
const Spin = lazy(() => import("@/pages/Spin"));
const Collections = lazy(() => import("@/pages/Collections"));
const Wrapped = lazy(() => import("@/pages/Wrapped"));

function PageFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-accent-500/30 border-t-accent-400 animate-spin" />
    </div>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Library />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/recent" element={<RecentlyPlayedPage />} />
          <Route path="/collections" element={<Lazy><Collections /></Lazy>} />
          <Route path="/stats" element={<Lazy><Stats /></Lazy>} />
          <Route path="/wrapped" element={<Lazy><Wrapped /></Lazy>} />
          <Route path="/spin" element={<Lazy><Spin /></Lazy>} />
          <Route path="/settings" element={<Lazy><Settings /></Lazy>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
