import type { SongContextInput } from "@verbo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextForm } from "./ContextForm.js";

function baseValue(overrides: Partial<SongContextInput> = {}): SongContextInput {
  return {
    theologicalTradition: "nao_selecionar",
    desiredChangeLevel: "refinar_mantendo_voz",
    bibleReferencesProvidedByUser: [],
    ...overrides,
  };
}

describe("ContextForm — click-first fields (público, estilo, humor)", () => {
  it("sets the value by clicking a preset chip, no typing required", () => {
    const onChange = vi.fn();
    render(<ContextForm value={baseValue()} onChange={onChange} />);
    fireEvent.click(screen.getByText("Jovens"));
    expect(onChange).toHaveBeenCalledWith({ intendedAudience: "Jovens" });
  });

  it("reveals a text input only after 'Outro' is clicked", () => {
    render(<ContextForm value={baseValue()} onChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText("Descreva o público")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Outro" })[0]);
    expect(screen.getByPlaceholderText("Descreva o público")).toBeInTheDocument();
  });

  it("keeps the custom text input visible (pre-filled) when the current value isn't one of the presets", () => {
    render(<ContextForm value={baseValue({ intendedStyle: "MPB cristã" })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("MPB cristã")).toBeInTheDocument();
  });
});

describe("ContextForm — bible reference chips", () => {
  it("adds a preset reference by clicking it", () => {
    const onChange = vi.fn();
    render(<ContextForm value={baseValue()} onChange={onChange} />);
    fireEvent.click(screen.getByText("João 3:16"));
    expect(onChange).toHaveBeenCalledWith({ bibleReferencesProvidedByUser: ["João 3:16"] });
  });

  it("removes an already-selected preset reference by clicking it again", () => {
    const onChange = vi.fn();
    render(<ContextForm value={baseValue({ bibleReferencesProvidedByUser: ["João 3:16"] })} onChange={onChange} />);
    fireEvent.click(screen.getByText("João 3:16"));
    expect(onChange).toHaveBeenCalledWith({ bibleReferencesProvidedByUser: [] });
  });

  it("adds a custom reference typed into the free-text field", () => {
    const onChange = vi.fn();
    render(<ContextForm value={baseValue()} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Outra referência (ex.: Salmos 84:1-2)");
    fireEvent.change(input, { target: { value: "Salmos 84:1-2" } });
    fireEvent.click(screen.getByText("Adicionar"));
    expect(onChange).toHaveBeenCalledWith({ bibleReferencesProvidedByUser: ["Salmos 84:1-2"] });
  });

  it("shows an already-selected custom reference as its own removable chip", () => {
    render(<ContextForm value={baseValue({ bibleReferencesProvidedByUser: ["Salmos 84:1-2"] })} onChange={vi.fn()} />);
    expect(screen.getByText("Salmos 84:1-2 ✕")).toBeInTheDocument();
  });
});

describe("ContextForm — detailed text fields are collapsed by default", () => {
  it("hides the free-text 'mais detalhes' fields behind a closed <details> disclosure", () => {
    render(<ContextForm value={baseValue()} onChange={vi.fn()} />);
    const details = screen.getByText("Mais detalhes sobre a composição (opcional)").closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
  });
});
