import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toast, ToastTitle, ToastDescription, ToastProvider, ToastViewport, ToastClose } from "@/components/ui/toast";

describe("Select", () => {
  it("renders options and fires change", () => {
    const onChange = vi.fn();
    render(
      <Select value="a" onChange={onChange} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Input", () => {
  it("renders and updates value", () => {
    const onChange = vi.fn();
    render(<Input placeholder="type" onChange={onChange} />);
    const input = screen.getByPlaceholderText("type");
    fireEvent.change(input, { target: { value: "hi" } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Tabs", () => {
  it("renders triggers and switches content", async () => {
    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Content One</TabsContent>
        <TabsContent value="two">Content Two</TabsContent>
      </Tabs>
    );
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Content One")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Two"));
    expect(screen.getByText("Content Two")).toBeInTheDocument();
  });
});

describe("Toast", () => {
  it("renders title and description", () => {
    render(
      <ToastProvider>
        <ToastViewport />
        <Toast open>
          <ToastTitle>Title</ToastTitle>
          <ToastDescription>Desc</ToastDescription>
          <ToastClose aria-label="Close" />
        </Toast>
      </ToastProvider>
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Desc")).toBeInTheDocument();
  });
});
