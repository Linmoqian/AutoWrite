import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingButton from "./LoadingButton";

describe("LoadingButton", () => {
  it("renders children text", () => {
    render(<LoadingButton>测试按钮</LoadingButton>);
    expect(screen.getByText("测试按钮")).toBeInTheDocument();
  });

  it("passes loading prop to antd Button", () => {
    render(<LoadingButton loading>加载中</LoadingButton>);
    const btn = screen.getByText("加载中").closest("button");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass("ant-btn-loading");
  });
});
