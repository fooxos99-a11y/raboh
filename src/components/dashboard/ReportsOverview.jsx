import React, { useState } from 'react';
import { BadgeCheck, BookOpen, Home, Link2, RefreshCw, Users } from 'lucide-react';
import CommitteeIndicatorsPanel from './reports/CommitteeIndicatorsPanel';
import QuranAchievementDropdown from './reports/QuranAchievementDropdown';
import { formatStatisticsNumber as formatNumber } from '@/lib/statisticsNumber';
const SummaryTile = ({ icon: Icon, title, value, color }) => (
  <div className="rounded-lg border border-primary/15 bg-background/70 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-black text-foreground">{formatNumber(value)}</p>
      </div>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}22`, color }}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
  </div>
);

const ReportsOverview = ({ data }) => {
  const [selectedCommitteeId, setSelectedCommitteeId] = useState(null);
  const totals = data?.totals || {};
  const quranFaces = totals.quranFaces || {};
  const committees = data?.committeeIndicators || [];
  const selectedCommitteeExists = committees.some((committee) => String(committee.id) === String(selectedCommitteeId));

  if (selectedCommitteeId && selectedCommitteeExists) {
    return (
      <CommitteeIndicatorsPanel
        committees={committees}
        selectedCommitteeId={selectedCommitteeId}
        onBack={() => setSelectedCommitteeId(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryTile icon={Users} title="الطلاب" value={totals.studentsCount} color="#38bdf8" />
        <SummaryTile icon={Home} title="عدد الحلقات" value={totals.familiesCount} color="#a3e635" />
        <SummaryTile icon={BookOpen} title="إجمالي أوجه الحفظ" value={quranFaces.memorization} color="#14b8a6" />
        <SummaryTile icon={BadgeCheck} title="إجمالي أوجه الإتقان" value={quranFaces.mastery} color="#8b5cf6" />
        <SummaryTile icon={RefreshCw} title="إجمالي أوجه المراجعة" value={quranFaces.review} color="#f59e0b" />
        <SummaryTile icon={Link2} title="إجمالي أوجه الربط" value={quranFaces.link} color="#06b6d4" />

      </div>

      <QuranAchievementDropdown data={data?.quranLeaders || {}} />
      <CommitteeIndicatorsPanel committees={committees} onSelectCommittee={setSelectedCommitteeId} />

    </div>
  );
};

export default ReportsOverview;
