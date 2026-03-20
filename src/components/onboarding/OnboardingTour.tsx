import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useScan } from "@/hooks/useGames";
import { api } from "@/lib/tauri";
import { getFastSteps, getStandardSteps, getDetailedSteps } from "./steps";
import TourSpotlight from "./TourSpotlight";
import TourCard from "./TourCard";
import TourFinale from "./TourFinale";
import type { TourStep } from "./steps";

function getSteps(mode: "fast" | "standard" | "detailed", deps: Parameters<typeof getFastSteps>[0]): TourStep[] {
  if (mode === "fast") return getFastSteps(deps);
  if (mode === "standard") return getStandardSteps(deps);
  return getDetailedSteps(deps);
}

export default function OnboardingTour() {
  const tourOpen = useUIStore((s) => s.tourOpen);
  const setTourOpen = useUIStore((s) => s.setTourOpen);
  const tourMode = useUIStore((s) => s.tourMode);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const setAddGameOpen = useUIStore((s) => s.setAddGameOpen);
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const navigate = useNavigate();
  const { scan } = useScan();

  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFinale, setShowFinale] = useState(false);
  const stepIndexRef = useRef(0);

  useEffect(() => {
    if (!tourOpen || !tourMode) return;
    const deps = { navigate, setSelectedGameId, setDetailOpen, setAddGameOpen, triggerScan: scan };
    const newSteps = getSteps(tourMode, deps);
    setSteps(newSteps);
    setStepIndex(0);
    stepIndexRef.current = 0;
    setShowFinale(false);

    (async () => {
      const first = newSteps[0];
      if (first?.before) {
        setLoading(true);
        try { await first.before(); } catch {}
        setLoading(false);
      }
      if (first?.afterRender) {
        try { await first.afterRender(); } catch {}
      }
    })();
  }, [tourOpen, tourMode]);

  const finishTour = useCallback(async () => {
    setTourOpen(false);
    setShowFinale(false);
    setDetailOpen(false);
    setAddGameOpen(false);
    navigate("/");
    await api.saveSetting("onboarding_completed", "true");
    if (tourMode) await api.saveSetting("onboarding_tour_mode", tourMode);
  }, [tourMode, setTourOpen, setDetailOpen, setAddGameOpen, navigate]);

  const completeTour = useCallback(async () => {
    const currentStep = steps[stepIndexRef.current];
    if (currentStep?.after) {
      try { await currentStep.after(); } catch {}
    }

    if (currentStep?.id === "done" || steps[stepIndexRef.current]?.id === "shortcuts") {
      setDetailOpen(false);
      setAddGameOpen(false);
      navigate("/");
      setShowFinale(true);
      return;
    }

    await finishTour();
  }, [steps, setDetailOpen, setAddGameOpen, navigate, finishTour]);

  const goToStep = useCallback(async (index: number) => {
    if (index < 0 || index >= steps.length) return;
    setLoading(true);

    const currentStep = steps[stepIndexRef.current];
    if (currentStep?.after) {
      try { await currentStep.after(); } catch {}
    }

    const nextStep = steps[index];

    if (nextStep.id === "done") {
      setDetailOpen(false);
      setAddGameOpen(false);
      navigate("/");
      await new Promise((r) => requestAnimationFrame(r));
      setShowFinale(true);
      setLoading(false);
      return;
    }

    if (nextStep.before) {
      try { await nextStep.before(); } catch {}
    }

    await new Promise((r) => requestAnimationFrame(r));
    stepIndexRef.current = index;
    setStepIndex(index);
    setLoading(false);

    if (nextStep.afterRender) {
      try { await nextStep.afterRender(); } catch {}
    }
  }, [steps, setDetailOpen, setAddGameOpen, navigate]);

  const handleNext = useCallback(async () => {
    if (stepIndexRef.current >= steps.length - 1) { await completeTour(); return; }
    await goToStep(stepIndexRef.current + 1);
  }, [steps.length, completeTour, goToStep]);

  const handleBack = useCallback(async () => {
    if (stepIndexRef.current > 0) await goToStep(stepIndexRef.current - 1);
  }, [goToStep]);

  useEffect(() => {
    if (!tourOpen || showFinale) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { completeTour(); return; }
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); handleNext(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); handleBack(); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [tourOpen, showFinale, handleNext, handleBack, completeTour]);

  if (!tourOpen || steps.length === 0) return null;

  if (showFinale) {
    return <TourFinale onComplete={finishTour} />;
  }

  const step = steps[stepIndex];
  const showChapters = tourMode === "detailed";

  return (
    <>
      <TourSpotlight target={step.target} stepId={step.id} />
      <TourCard
        step={step}
        stepIndex={stepIndex}
        totalSteps={steps.length - 1}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={completeTour}
        showChapters={showChapters}
        loading={loading}
      />
    </>
  );
}
