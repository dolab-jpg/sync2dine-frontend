interface AuthFormErrorProps {
  message?: string;
}

export function AuthFormError({ message }: AuthFormErrorProps) {
  if (!message) return null;
  return <p className="text-sm text-red-600" role="alert">{message}</p>;
}
