import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CredentialForm } from "../CredentialForm";
import type { ApiCredential } from "@prisma/client";

describe("CredentialForm", () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

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
    lastValidatedAt: new Date(),
    lastUsedAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  describe("Create Mode", () => {
    it("renders create form with correct title", () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.getByText("Add Provider")).toBeInTheDocument();
    });

    it("validates required name field", async () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(screen.getByText("Name is required")).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("validates name format", async () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const nameInput = screen.getByPlaceholderText("e.g., Gemini Production");
      fireEvent.change(nameInput, { target: { value: "Invalid@Name!" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(
          screen.getByText(/Name must be 1-50 characters/)
        ).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("validates required API key", async () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const nameInput = screen.getByPlaceholderText("e.g., Gemini Production");
      fireEvent.change(nameInput, { target: { value: "Valid Name" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(screen.getByText("API key is required")).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("validates API key length", async () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const nameInput = screen.getByPlaceholderText("e.g., Gemini Production");
      const apiKeyInput = screen.getByPlaceholderText("Enter API key");

      fireEvent.change(nameInput, { target: { value: "Valid Name" } });
      fireEvent.change(apiKeyInput, { target: { value: "short" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(
          screen.getByText("API key must be at least 8 characters")
        ).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("validates base URL format for non-Gemini providers", async () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const providerSelect = screen.getByRole("combobox");
      fireEvent.change(providerSelect, { target: { value: "crs" } });

      const nameInput = screen.getByPlaceholderText("e.g., Gemini Production");
      const apiKeyInput = screen.getByPlaceholderText("Enter API key");
      const baseUrlInput = screen.getByPlaceholderText("https://api.example.com");

      fireEvent.change(nameInput, { target: { value: "Valid Name" } });
      fireEvent.change(apiKeyInput, { target: { value: "validkey123" } });
      fireEvent.change(baseUrlInput, { target: { value: "invalid-url" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(screen.getByText("Invalid URL format")).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("submits valid form data", async () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const nameInput = screen.getByPlaceholderText("e.g., Gemini Production");
      const apiKeyInput = screen.getByPlaceholderText("Enter API key");

      fireEvent.change(nameInput, { target: { value: "My Gemini Key" } });
      fireEvent.change(apiKeyInput, { target: { value: "validkey123" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          provider: "gemini",
          name: "My Gemini Key",
          apiKey: "validkey123",
          baseUrl: "",
          model: "",
          isDefault: false,
          validate: true,
        });
      });
    });

    it("shows base URL field for non-Gemini providers", () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const providerSelect = screen.getByRole("combobox");
      fireEvent.change(providerSelect, { target: { value: "crs" } });

      expect(screen.getByPlaceholderText("https://api.example.com")).toBeInTheDocument();
    });

    it("hides base URL field for Gemini provider", () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.queryByPlaceholderText("https://api.example.com")).not.toBeInTheDocument();
    });
  });

  describe("Edit Mode", () => {
    it("renders edit form with correct title", () => {
      render(
        <CredentialForm
          mode="edit"
          credential={mockCredential}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Edit Provider")).toBeInTheDocument();
    });

    it("pre-fills form with credential data", () => {
      render(
        <CredentialForm
          mode="edit"
          credential={mockCredential}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Credential");
      const modelInput = screen.getByDisplayValue("gemini-2.0-flash");

      expect(nameInput).toBeInTheDocument();
      expect(modelInput).toBeInTheDocument();
    });

    it("disables provider selection in edit mode", () => {
      render(
        <CredentialForm
          mode="edit"
          credential={mockCredential}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const providerSelect = screen.getByRole("combobox");
      expect(providerSelect).toBeDisabled();
    });

    it("allows empty API key in edit mode", async () => {
      render(
        <CredentialForm
          mode="edit"
          credential={mockCredential}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe("Form Actions", () => {
    it("calls onCancel when cancel button clicked", () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      fireEvent.click(screen.getByText("Cancel"));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("shows loading state during submission", async () => {
      mockOnSubmit.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const nameInput = screen.getByPlaceholderText("e.g., Gemini Production");
      const apiKeyInput = screen.getByPlaceholderText("Enter API key");

      fireEvent.change(nameInput, { target: { value: "Valid Name" } });
      fireEvent.change(apiKeyInput, { target: { value: "validkey123" } });
      fireEvent.click(screen.getByText("Save"));

      expect(screen.getByText("Saving...")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
      });
    });

    it("displays error message on submission failure", async () => {
      mockOnSubmit.mockRejectedValue(new Error("Network error"));

      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const nameInput = screen.getByPlaceholderText("e.g., Gemini Production");
      const apiKeyInput = screen.getByPlaceholderText("Enter API key");

      fireEvent.change(nameInput, { target: { value: "Valid Name" } });
      fireEvent.change(apiKeyInput, { target: { value: "validkey123" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  describe("Checkboxes", () => {
    it("allows toggling default checkbox", () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const defaultCheckbox = screen.getByLabelText("Set as default provider");
      expect(defaultCheckbox).not.toBeChecked();

      fireEvent.click(defaultCheckbox);
      expect(defaultCheckbox).toBeChecked();
    });

    it("allows toggling validate checkbox", () => {
      render(<CredentialForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const validateCheckbox = screen.getByLabelText("Validate credentials before saving");
      expect(validateCheckbox).toBeChecked();

      fireEvent.click(validateCheckbox);
      expect(validateCheckbox).not.toBeChecked();
    });
  });
});
