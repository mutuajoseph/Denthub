import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { International } from "./International";

function renderPage() {
  return render(
    <MemoryRouter>
      <International />
    </MemoryRouter>,
  );
}

describe("International", () => {
  it("shows accessible validation before accepting a patient lead", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /preview my quote request/i }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Choose a treatment interest");
    expect(alert).toHaveTextContent("Enter your country of residence");
    expect(alert).toHaveTextContent("Enter a valid email address");
    expect(alert).toHaveTextContent("Tell us briefly about your treatment goals");
  });

  it("validates a complete lead and presents a non-persistent success state", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(
      screen.getByRole("combobox", { name: /treatment interest/i }),
      "Dental implants",
    );
    await user.type(
      screen.getByRole("textbox", { name: /country of residence/i }),
      "United Kingdom",
    );
    await user.type(screen.getByRole("textbox", { name: /email address/i }), "patient@example.com");
    await user.type(
      screen.getByRole("textbox", { name: /treatment goals/i }),
      "I would like to understand implant options and likely travel requirements.",
    );
    await user.click(screen.getByRole("button", { name: /preview my quote request/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/your request is ready to review/i);
    expect(screen.getByText(/no details were sent or saved/i)).toBeInTheDocument();
    expect(screen.getByText("patient@example.com")).toBeInTheDocument();
  });
});
