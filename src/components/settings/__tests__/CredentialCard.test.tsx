import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CredentialCard } from "../CredentialCard";
import type { ApiCredential } from "@prisma/client";

describe("CredentialCard", () => {
  const mockCredential: ApiCredential = {
    id: "test-id",
    provider: "gemini",
    name: "Test Credential",
    encryptedKey: "encrypted",
    keyHint: "AIza...xyz",
    baseUrl: null,
    model: "gemini-2.0-flash",
    config: null,
    isDefault: false,
    isValid: true,
    validationError: null,
    lastValidatedAt: new Date("2026-03-11"),
    lastUsedAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHandlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onTest: vi.fn(),
    onSetDefault: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders credential information", () => {
    render(<CredentialCard credential={mockCredential} {...mockHandlers} />);

    expect(screen.getByText("Test Credential")).toBeInTheDocument();
    expect(screen.getByText(/GEMINI/)).toBeInTheDocument();
    expect(screen.getByText(/gemini-2.0-flash/)).toBeInTheDocument();
    expect(screen.getByText(/AIza...xyz/)).toBeInTheDocument();
  });

  it("shows valid status for valid credential", () => {
    render(<CredentialCard credential={mockCredential} {...mockHandlers} />);

    expect(screen.getByText("Valid")).toBeInTheDocument();
  });

  it("shows invalid status for invalid credential", () => {
    const invalidCredential = {
      ...mockCredential,
      isValid: false,
      validationError: "Invalid API key",
    };

    render(<CredentialCard credential={invalidCredential} {...mockHandlers} />);

    expect(screen.getByText("Invalid")).toBeInTheDocument();
    expect(screen.getByText("Invalid API key")).toBeInTheDocument();
  });

  it("shows not validated status when lastValidatedAt is null", () => {
    const unvalidatedCredential = {
      ...mockCredential,
      lastValidatedAt: null,
    };

    render(<CredentialCard credential={unvalidatedCredential} {...mockHandlers} />);

    expect(screen.getByText("Not validated")).toBeInTheDocument();
  });

  it("shows default badge for default credential", () => {
    const defaultCredential = {
      ...mockCredential,
      isDefault: true,
    };

    render(<CredentialCard credential={defaultCredential} {...mockHandlers} />);

    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("hides set default button for default credential", () => {
    const defaultCredential = {
      ...mockCredential,
      isDefault: true,
    };

    render(<CredentialCard credential={defaultCredential} {...mockHandlers} />);

    expect(screen.queryByText("Set as Default")).not.toBeInTheDocument();
  });

  it("shows base URL when provided", () => {
    const credentialWithUrl = {
      ...mockCredential,
      baseUrl: "https://api.example.com",
    };

    render(<CredentialCard credential={credentialWithUrl} {...mockHandlers} />);

    expect(screen.getByText(/https:\/\/api.example.com/)).toBeInTheDocument();
  });

  it("calls onEdit when edit button clicked", () => {
    render(<CredentialCard credential={mockCredential} {...mockHandlers} />);

    fireEvent.click(screen.getByText("Edit"));

    expect(mockHandlers.onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button clicked", () => {
    render(<CredentialCard credential={mockCredential} {...mockHandlers} />);

    fireEvent.click(screen.getByText("Delete"));

    expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it("calls onTest when test button clicked", () => {
    render(<CredentialCard credential={mockCredential} {...mockHandlers} />);

    fireEvent.click(screen.getByText("Test"));

    expect(mockHandlers.onTest).toHaveBeenCalledTimes(1);
  });

  it("calls onSetDefault when set default button clicked", () => {
    render(<CredentialCard credential={mockCredential} {...mockHandlers} />);

    fireEvent.click(screen.getByText("Set as Default"));

    expect(mockHandlers.onSetDefault).toHaveBeenCalledTimes(1);
  });

  it("shows last validated date", () => {
    render(<CredentialCard credential={mockCredential} {...mockHandlers} />);

    expect(screen.getByText(/Validated: 3\/11\/2026/)).toBeInTheDocument();
  });
});
