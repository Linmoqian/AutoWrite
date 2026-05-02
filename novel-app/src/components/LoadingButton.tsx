import { Button, type ButtonProps } from "antd";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
}

export default function LoadingButton({ loading, children, ...props }: LoadingButtonProps) {
  return (
    <Button loading={loading} {...props}>
      {children}
    </Button>
  );
}
