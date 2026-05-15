import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import HomeScreen, { type HomeScreenExercise } from "@/components/HomeScreen";

export const Route = createFileRoute("/home")({
  component: HomeRoute,
});

const EXERCISES: HomeScreenExercise[] = [
  { id: 1, order_in_level: 1, type: "hold_note", pass_threshold: 0.6 },
  { id: 2, order_in_level: 2, type: "sing_scale", pass_threshold: 0.7 },
  { id: 3, order_in_level: 3, type: "mimic_phrase", pass_threshold: 0.75 },
];

function HomeRoute() {
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <HomeScreen
      user={{
        username: "alex",
        display_name: "Alex",
        avatar: null,
        current_streak: 7,
        longest_streak: 14,
        last_practice_date: new Date().toISOString(),
        current_level: { id: 1, order: 2, name: "Finding Pitch", category: "Beginner" },
      }}
      exercises={EXERCISES}
      isLoadingExercises={false}
      exercisesError={null}
      isSigningOut={isSigningOut}
      signOutError={null}
      onSelectExercise={() => navigate({ to: "/practice" })}
      onSignOut={() => {
        setIsSigningOut(true);
        setTimeout(() => setIsSigningOut(false), 800);
      }}
    />
  );
}
