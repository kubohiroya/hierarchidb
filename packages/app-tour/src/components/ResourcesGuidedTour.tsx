import React from 'react';
import type { TourStep } from '@hierarchidb/11-ui-tour';
import { GenericGuidedTour } from '@hierarchidb/11-ui-tour';

interface ResourcesGuidedTourProps {
  run: boolean;
  onFinish?: () => void;
}

export const ResourcesGuidedTour: React.FC<ResourcesGuidedTourProps> = ({
  run,
  onFinish,
}) => {
  // Create steps with dynamic content
  const steps: TourStep[] = [
    {
      target: "body",
      content: (
        <div
          style={{ textAlign: "center", padding: "20px", minWidth: "400px" }}
        >
          <h2>Welcome to Resources! 📊</h2>
          <p style={{ marginBottom: "16px" }}>
            Resources contain your data that can be visualized and analyzed.
            You can import various data formats and organize them hierarchically.
          </p>
          <p>
            This guided tour will help you understand how to manage and utilize
            your resources effectively.
          </p>
        </div>
      ),
      placement: "center",
      disableBeacon: true,
      styles: {
        tooltip: {
          borderRadius: "20px",
        },
      },
    },
    {
      target: '[title="Back to Home"]',
      content: (
        <div>
          <h3>Navigation - Home 🏠</h3>
          <p>
            Click this icon button in the top-left corner to return to the home
            screen at any time.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[aria-label="tree selection"]',
      content: (
        <div>
          <h3>Navigation - Tree Switcher 🔄</h3>
          <p>
            Use this toggle to switch between different tree views.
            You're currently viewing the Resources tree.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[role="navigation"][aria-label="breadcrumb"]',
      content: (
        <div>
          <h3>Hierarchical Navigation 📍</h3>
          <p>
            Resources are organized in a hierarchical structure. The breadcrumb
            shows your current location.
          </p>
          <p style={{ marginTop: 8 }}>
            • Navigate by clicking breadcrumb items
          </p>
          <p>
            • Access context menus for quick actions
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[aria-label="Tree console toolbar"]',
      content: (
        <div>
          <h3>Resource Management Toolbar 🔧</h3>
          <p>
            The toolbar provides essential tools for managing your resources:
          </p>
          <ul style={{ textAlign: "left", paddingLeft: 20 }}>
            <li>Create new resources and folders</li>
            <li>Edit and organize existing data</li>
            <li>Search and filter capabilities</li>
            <li>Undo/redo operations</li>
          </ul>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[aria-label="Create Action"]',
      content: (
        <div>
          <h3>Quick Resource Creation ⚡</h3>
          <p>The floating action button allows you to:</p>
          <ul style={{ textAlign: "left", paddingLeft: 20 }}>
            <li>Create new data resources</li>
            <li>Import CSV, JSON, or other data formats</li>
            <li>Create organizational folders</li>
          </ul>
        </div>
      ),
      placement: "left",
      disableBeacon: true,
    },
    {
      target: '[aria-label="Import and export options"]',
      content: (
        <div>
          <h3>Data Import & Export 📤📥</h3>
          <p>
            Powerful import/export capabilities:
          </p>
          <ul style={{ textAlign: "left", paddingLeft: 20 }}>
            <li>Import data from various formats (CSV, JSON, XML)</li>
            <li>Use templates for quick setup</li>
            <li>Export selected resources for backup or sharing</li>
          </ul>
        </div>
      ),
      placement: "left",
      disableBeacon: true,
    },
    {
      target: '[data-testid="tree-table"]',
      content: (
        <div>
          <h3>Resource Table View 📋</h3>
          <p>
            The table view displays your resources with:
          </p>
          <ul style={{ textAlign: "left", paddingLeft: 20 }}>
            <li>Sortable columns for easy organization</li>
            <li>Multi-select for batch operations</li>
            <li>Expandable rows for hierarchical data</li>
            <li>Right-click context menus for quick actions</li>
          </ul>
        </div>
      ),
      placement: "top",
      disableBeacon: true,
    },
  ];

  return (
    <GenericGuidedTour
      run={run}
      onFinish={onFinish}
      steps={steps}
      tourType="resourcesTour"
    />
  );
};