/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { B } from './bushido.js';
import { Store } from './store.js';
import { UICommon } from './ui-common.js';
import { UICohorts } from './ui-cohorts.js';
import { UIGroups } from './ui-groups.js';
import { UIDaily } from './ui-daily.js';
import { UIReports } from './ui-reports.js';
import { UISettings } from './ui-settings.js';
import { UIWizard } from './ui-wizard.js';

const h = React.createElement;


function MainApp() {
  var [appState, setAppState] = React.useState(Store.getState());
  var [activeTab, setActiveTab] = React.useState('groups'); // 'groups' | 'daily' | 'reports' | 'settings'

  // دیالوگ‌های سراسری
  var [cohortModalOpen, setCohortModalOpen] = React.useState(false);
  var [cohortModalMode, setCohortModalMode] = React.useState('new'); // 'new' | 'edit'
  var [restoreModalOpen, setRestoreModalOpen] = React.useState(false);
  var [importWizardOpen, setImportWizardOpen] = React.useState(false);

  var toast = B.useToast();

  React.useEffect(function () {
    var unsubscribe = Store.subscribe(function (newState) {
      setAppState(Object.assign({}, newState));
    });
    return unsubscribe;
  }, []);

  var activeCohort = Store.getActiveCohort();

  // ناوبری تب‌های اصلی
  var navTabs = [
    { id: 'groups', label: 'گروه‌ها و اعضا' },
    { id: 'daily', label: 'ثبت روزانه' },
    { id: 'reports', label: 'گزارش‌ها و خروجی اکسل' },
    { id: 'settings', label: 'تنظیمات' }
  ];

  return h('div', {
    className: 'bsh-app-shell',
    style: {
      minHeight: '100vh',
      background: 'var(--surface-page)',
      color: 'var(--text-default)',
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
      width: '100%'
    }
  },
    // هدر برنامه
    h(UICommon.Header, {
      state: appState,
      activeCohort: activeCohort,
      onOpenCohortModal: function (mode) {
        setCohortModalMode(mode || 'new');
        setCohortModalOpen(true);
      },
      onOpenImportWizard: function () {
        if (!activeCohort) {
          toast.show({ intent: 'warning', message: 'ابتدا یک دوره بسازید.' });
          return;
        }
        setImportWizardOpen(true);
      },
      onOpenRestoreModal: function () {
        setRestoreModalOpen(true);
      }
    }),

    // هشدارهای سیستمی
    h(UICommon.BackupReminderBanner),
    h(UICommon.MultiTabWarningBanner),

    // بدنه اصلی
    h('main', {
      className: 'bsh-app-main',
      style: {
        flex: 1,
        maxWidth: 1280,
        width: '100%',
        margin: '0 auto',
        padding: 'var(--space-4)',
        paddingInline: 'clamp(var(--space-3), 3vw, var(--space-6))',
        boxSizing: 'border-box'
      }
    },
      !activeCohort ? (
        h(UICohorts.EmptyCohortState, {
          onCreateCohort: function () {
            setCohortModalMode('new');
            setCohortModalOpen(true);
          },
          onRestoreBackup: function () {
            setRestoreModalOpen(true);
          }
        })
      ) : (
        h('div', { className: 'bsh-stack bsh-stack--lg' },
          // نوار تب‌های اصلی با اسکرول افقی روی موبایل
          h('div', { style: { maxWidth: '100%' } },
            h(B.Tabs, {
              label: 'بخش‌های اصلی',
              items: navTabs,
              value: activeTab,
              onChange: function (id) { setActiveTab(id); }
            })
          ),

          // تب‌های مختلف
          activeTab === 'groups' && h(UIGroups.GroupsTab, {
            cohort: activeCohort,
            toast: toast
          }),

          activeTab === 'daily' && h(UIDaily.DailyScoringTab, {
            cohort: activeCohort,
            toast: toast
          }),

          activeTab === 'reports' && h(UIReports.ReportsTab, {
            cohort: activeCohort,
            toast: toast
          }),

          activeTab === 'settings' && h(UISettings.SettingsTab, {
            cohort: activeCohort,
            toast: toast
          })
        )
      )
    ),

    // دیالوگ‌های مشترک
    cohortModalOpen && h(UICohorts.CohortModal, {
      open: cohortModalOpen,
      cohort: cohortModalMode === 'edit' ? activeCohort : null,
      existingCohorts: appState.cohorts || [],
      onClose: function () { setCohortModalOpen(false); },
      toast: toast
    }),

    restoreModalOpen && h(UICohorts.RestoreBackupModal, {
      open: restoreModalOpen,
      onClose: function () { setRestoreModalOpen(false); },
      toast: toast
    }),

    importWizardOpen && activeCohort && h(UIWizard.ImportWizardModal, {
      open: importWizardOpen,
      cohort: activeCohort,
      onClose: function () { setImportWizardOpen(false); },
      toast: toast
    })
  );
}

export default function RootApp() {
  return h(B.ToastProvider, null, h(MainApp));
}

// رندر در عنصر root
var mountNode = document.getElementById('root');
if (mountNode) {
  createRoot(mountNode).render(h(RootApp));
}
