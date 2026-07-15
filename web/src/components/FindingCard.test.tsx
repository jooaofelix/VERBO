import type { AnalysisFinding } from "@verbo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FindingCard } from "./FindingCard.js";

function finding(overrides: Partial<AnalysisFinding> = {}): AnalysisFinding {
  return {
    id: "f1",
    category: "grammar",
    originalExcerpt: "Eu eu quero",
    title: "Repetição involuntária",
    explanation: "A palavra aparece repetida.",
    confidence: "medium",
    severity: "probable_error",
    requiresUserContext: false,
    ...overrides,
  };
}

describe("FindingCard", () => {
  it("shows the excerpt, title and explanation", () => {
    render(<FindingCard finding={finding()} />);
    expect(screen.getByText(/Eu eu quero/)).toBeInTheDocument();
    expect(screen.getByText("Repetição involuntária")).toBeInTheDocument();
    expect(screen.getByText(/aparece repetida/)).toBeInTheDocument();
  });

  it("calls onDecide with 'accepted' when Aceitar is clicked", () => {
    const onDecide = vi.fn();
    render(<FindingCard finding={finding()} onDecide={onDecide} />);
    fireEvent.click(screen.getByText("✓ Aceitar"));
    expect(onDecide).toHaveBeenCalledWith("accepted");
  });

  it("toggles back to undefined when clicking an already-accepted decision", () => {
    const onDecide = vi.fn();
    render(<FindingCard finding={finding()} decision="accepted" onDecide={onDecide} />);
    fireEvent.click(screen.getByText("✓ Aceitar"));
    expect(onDecide).toHaveBeenCalledWith(undefined);
  });

  it("flags findings that require the composer's own context", () => {
    render(<FindingCard finding={finding({ requiresUserContext: true })} />);
    expect(screen.getByText(/só você, compositor, pode confirmar/i)).toBeInTheDocument();
  });
});
