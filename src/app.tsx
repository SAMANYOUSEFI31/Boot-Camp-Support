/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { B } from './bushido';
import { Store } from './store';
import { UICommon } from './ui-common';
import { UICohorts } from './ui-cohorts';
import { UIGroups } from './ui-groups';
import { UIDaily } from './ui-daily';
import { UIReports } from './ui-reports';
import { UISettings } from './ui-settings';
import { UIWizard } from './ui-wizard';

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
      <UICommon.Header
        state={appState}
        activeCohort={activeCohort}
        onOpenCohortModal={function (mode?: 'new' | 'edit') {
          setCohortModalMode(mode || 'new');
          setCohortModalOpen(true);
        }}
        onOpenImportWizard={function () {
          if (!activeCohort) {
            toast.show({ intent: 'warning', message: 'ابتدا یک دوره بسازید.' });
            return;
          }
          setImportWizardOpen(true);
        }}
        onOpenRestoreModal={function () {
          setRestoreModalOpen(true);
        }}
      />
      <UICommon.BackupReminderBanner />
      <UICommon.MultiTabWarningBanner />
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
          <UICohorts.EmptyCohortState
            onCreateCohort={function () {
              setCohortModalMode('new');
              setCohortModalOpen(true);
            }}
            onRestoreBackup={function () {
              setRestoreModalOpen(true);
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
            {activeTab === 'groups' && <UIGroups.GroupsTab cohort={activeCohort} toast={toast} />}
            {activeTab === 'daily' && <UIDaily.DailyScoringTab cohort={activeCohort} toast={toast} />}
            {activeTab === 'reports' && <UIReports.ReportsTab cohort={activeCohort} toast={toast} />}
            {activeTab === 'settings' && <UISettings.SettingsTab cohort={activeCohort} toast={toast} />}
          </div>
        )}
      </main>
      {cohortModalOpen && (
        <UICohorts.CohortModal
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
        <UICohorts.RestoreBackupModal
          open={restoreModalOpen}
          onClose={function () {
            setRestoreModalOpen(false);
          }}
          toast={toast}
        />
      )}
      {importWizardOpen && activeCohort && (
        <UIWizard.ImportWizardModal
          open={importWizardOpen}
          cohort={activeCohort}
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
