"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TimePicker({ value, onChange, disabled, className }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("09");
  const [minutes, setMinutes] = useState("00");

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      setHours(h || "09");
      setMinutes(m || "00");
    }
  }, [value]);

  const handleHoursChange = (h: string) => {
    setHours(h);
    onChange(`${h.padStart(2, "0")}:${minutes.padStart(2, "0")}`);
  };

  const handleMinutesChange = (m: string) => {
    setMinutes(m);
    onChange(`${hours.padStart(2, "0")}:${m.padStart(2, "0")}`);
  };

  const displayValue = value || "09:00";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-[120px] justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground text-center">Hora</label>
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
              {Array.from({ length: 24 }, (_, i) => {
                const h = i.toString().padStart(2, "0");
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHoursChange(h)}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors",
                      hours === h && "bg-primary text-primary-foreground"
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground text-center">Minuto</label>
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
              {[0, 15, 30, 45].map((m) => {
                const mStr = m.toString().padStart(2, "0");
                return (
                  <button
                    key={mStr}
                    type="button"
                    onClick={() => handleMinutesChange(mStr)}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors",
                      minutes === mStr && "bg-primary text-primary-foreground"
                    )}
                  >
                    {mStr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

