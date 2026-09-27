import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { DentalChatbot } from "./DentalChatbot";

function renderChatbot() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<DentalChatbot />} />
        <Route path="/emergency" element={<p>Emergency care page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function askQuestion(question: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open dental assistant" }));
  await user.type(
    screen.getByRole("textbox", { name: "Ask Dr. Denta a dental question" }),
    question,
  );
  await user.click(screen.getByRole("button", { name: "Send message to dental assistant" }));
}

describe("DentalChatbot", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("escalates emergency symptoms to the emergency page", async () => {
    renderChatbot();
    await askQuestion("My adult tooth was knocked out");

    expect(await screen.findByText(/this may be a dental emergency/i)).toBeInTheDocument();
    const emergencyLink = screen.getByRole("link", { name: /go to emergency help/i });
    await userEvent.setup().click(emergencyLink);
    expect(screen.getByText("Emergency care page")).toBeInTheDocument();
  });

  it("does not present diagnosis requests as a diagnosis", async () => {
    renderChatbot();
    await askQuestion("Can you diagnose my cavity?");

    expect(await screen.findByText(/cannot diagnose a condition/i)).toBeInTheDocument();
    expect(screen.getByText(/see a dentist/i)).toBeInTheDocument();
  });
});
