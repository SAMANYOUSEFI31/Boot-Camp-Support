/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { B } from './bushido';
import { Store } from './store';
import { BackupReminderBanner, Header, MultiTabWarningBanner } from './ui-common';
import { CohortModal, EmptyCohortState, RestoreBackupModal } from './ui-cohorts';
import { GroupsTab } from './ui-groups';
import { DailyScoringTab } from './daily/DailyScoringTab';
import { ReportsTab } from './ui-reports';
import { SettingsTab } from './ui-settings';
import { ImportWizardModal } from './ui-wizard';

function MainApp() {
  const [appState, setAppState] = useState(Store.getState());
  const [activeTab, setActiveTab] = useState('groups'); // 'groups' | 'daily' | 'reports' | 'settings'

  // دیالوگ‌های سراسری
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [cohortModalMode, setCohortModalMode] = useState('new'); // 'new' | 'edit'
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  const toast = B.useToast();

  useEffect(function () {
    const unsubscribe = Store.subscribe(function (newState) {
      setAppState(Object.assign({}, newState));
    });
    return unsubscribe;
  }, []);

  const activeCohort = Store.getActiveCohort();

  // ناوبری تب‌های اصلی
  const navTabs = [
    { id: 'groups', label: 'گروه‌ها و اعضا' },
    { id: 'daily', label: 'ثبت روزانه' },
    { id: 'reports', label: 'گزارش‌ها و خروجی اکسل' },
    { id: 'settings', label: 'تنظیمات' }
  ];

  return (
    <div
      className="bsh-app-shell"
      style={{
        minHeight: '100vh',
        background: 'var(--surface-page)',
        color: 'var(--text-default)',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        width: '100%'
      }}
    >
      <Header
        state={appState}
        activeCohort={activeCohort}
        onOpenCohortModal={function (mode?: 'new' | 'edit') {
          setCohortModalMode(mode || 'new');
          setCohortModalOpen(true);
        }}
        onOpenImportWizard={function () {
          setImportWizardOpen(true);
        }}
        onOpenRestoreModal={function () {
          setRestoreModalOpen(true);
        }}
      />
      <BackupReminderBanner />
      <MultiTabWarningBanner />
      <main
        className="bsh-app-main"
        style={{
          flex: 1,
          maxWidth: 1280,
          width: '100%',
          margin: '0 auto',
          padding: 'var(--space-4)',
          paddingInline: 'clamp(var(--space-3), 3vw, var(--space-6))',
          boxSizing: 'border-box'
        }}
      >
        {!activeCohort ? (
          <EmptyCohortState
            onCreateCohort={function () {
              setCohortModalMode('new');
              setCohortModalOpen(true);
            }}
            onRestoreBackup={function () {
              setRestoreModalOpen(true);
            }}
            onImport={function () {
              setImportWizardOpen(true);
            }}
          />
        ) : (
          <div className="bsh-stack bsh-stack--lg">
            <div style={{ maxWidth: '100%' }}>
              <B.Tabs
                label="بخش‌های اصلی"
                items={navTabs}
                value={activeTab}
                onChange={function (id) {
                  setActiveTab(id);
                }}
              />
            </div>
            {activeTab === 'groups' && <GroupsTab cohort={activeCohort} toast={toast} />}
            {activeTab === 'daily' && <DailyScoringTab cohort={activeCohort} toast={toast} />}
            {activeTab === 'reports' && <ReportsTab cohort={activeCohort} toast={toast} />}
            {activeTab === 'settings' && <SettingsTab cohort={activeCohort} toast={toast} />}
          </div>
        )}
      </main>
      {cohortModalOpen && (
        <CohortModal
          open={cohortModalOpen}
          cohort={cohortModalMode === 'edit' ? activeCohort : null}
          existingCohorts={appState.cohorts || []}
          onClose={function () {
            setCohortModalOpen(false);
          }}
          toast={toast}
        />
      )}
      {restoreModalOpen && (
        <RestoreBackupModal
          open={restoreModalOpen}
          onClose={function () {
            setRestoreModalOpen(false);
          }}
          toast={toast}
        />
      )}
      {importWizardOpen && (
        <ImportWizardModal
          open={importWizardOpen}
          cohorts={appState.cohorts}
          activeCohortId={activeCohort ? activeCohort.id : null}
          onClose={function () {
            setImportWizardOpen(false);
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

export default function RootApp() {
  return (
    <B.ToastProvider>
      <MainApp />
    </B.ToastProvider>
  );
}

// رندر در عنصر root
const mountNode = document.getElementById('root');
if (mountNode) {
  createRoot(mountNode).render(<RootApp />);
}
