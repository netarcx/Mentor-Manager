export interface ShiftWithSignups {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  cancelled: boolean;
  signups: {
    id: number;
    note: string;
    signedUpAt: Date;
    mentor: {
      id: number;
      name: string;
      email: string;
    };
  }[];
}

export interface LeaderboardEntry {
  mentorName: string;
  mentorEmail: string;
  totalHours: number;
  shiftCount: number;
}

export interface LeaderboardStats {
  totalHours: number;
  avgHoursPerMentor: number;
  totalShifts: number;
  mentorCount: number;
}

export interface DashboardData {
  currentShift: ShiftWithSignups | null;
  nextShift: ShiftWithSignups | null;
}
