import React from "react";

export function getGradeColor(grade: string): string {
  const letter = grade ? grade.charAt(0) : "";
  const colors: Record<string, string> = {
    A: "bg-emerald-600 text-white", B: "bg-sky-600 text-white",
    C: "bg-amber-500 text-black", D: "bg-orange-600 text-white", F: "bg-red-600 text-white",
  };
  return colors[letter] || "bg-muted text-muted-foreground";
}

export function GradeHex({ grade }: { grade?: string | null }) {
  if (!grade) {
    return (
      <div className="w-5 h-6 clip-hexagon flex items-center justify-center flex-shrink-0 text-[10px] font-bold bg-muted text-muted-foreground">
        -
      </div>
    );
  }

  if (grade.includes("//")) {
    const parts = grade.split("//");
    return (
      <div className={`w-5 h-6 clip-hexagon flex flex-col items-center justify-center flex-shrink-0 font-bold leading-none ${getGradeColor(parts[0])}`}>
        <span className="text-[6.5px] leading-none -translate-y-[0.5px]">{parts[0]}</span>
        <div className="w-3.5 h-[1px] bg-white/80 my-[0.5px]"></div>
        <span className="text-[6.5px] leading-none translate-y-[0.5px]">{parts[1]}</span>
      </div>
    );
  }

  return (
    <div className={`w-5 h-6 clip-hexagon flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${getGradeColor(grade)}`}>
      {grade}
    </div>
  );
}
