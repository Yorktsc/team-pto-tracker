import { useState } from 'react';
import { PtoForm } from './components/PtoForm';
import { PtoEntriesList } from './components/PtoEntriesList';
import { PtoTimeline } from './components/PtoTimeline';
import { PtoCalendarHeatmap } from './components/PtoCalendarHeatmap';

function App() {
  // On mutation, bump the version. We pass it to each data component as
  // `cacheKey`, which in turn is sent as a (SQL-ignored) query parameter so
  // the analytics plugin caches each mutation generation under a fresh key.
  const [dataVersion, setDataVersion] = useState(0);
  const cacheKey = `v${dataVersion}`;
  const bump = () => setDataVersion((v) => v + 1);

  return (
    <div className="min-h-screen bg-background flex flex-col p-4 md:p-8 w-full">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2 text-foreground">Team PTO Tracker</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Log your time off and see at a glance when the team has coverage gaps.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-7xl mx-auto">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <PtoForm onCreated={bump} />
          <PtoEntriesList cacheKey={cacheKey} onDeleted={bump} />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <PtoCalendarHeatmap cacheKey={cacheKey} />
          <PtoTimeline cacheKey={cacheKey} />
        </div>
      </div>
    </div>
  );
}

export default App;
