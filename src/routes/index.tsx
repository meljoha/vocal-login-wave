import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import LoginPage from "@/components/LoginPage";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <LoginPage
      isPending={isPending}
      errorMessage={errorMessage}
      onSubmit={(username, password) => {
        setErrorMessage(null);
        setIsPending(true);
        setTimeout(() => {
          setIsPending(false);
          if (!username || !password) {
            setErrorMessage("Please enter both your username and password.");
          } else {
            setErrorMessage(null);
            console.log("Login submitted", { username, password });
          }
        }, 900);
      }}
      onGoToRegister={() => {
        console.log("Go to register");
      }}
    />
  );
}
