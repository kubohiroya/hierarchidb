import React from 'react';
import type { TourStep } from '@hierarchidb/11-ui-tour';
import { GenericGuidedTour } from '@hierarchidb/11-ui-tour';

interface ProjectsGuidedTourProps {
  run: boolean;
  onFinish?: () => void;
}

export const ProjectsGuidedTour: React.FC<ProjectsGuidedTourProps> = ({
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
          <h2>Welcome to Projects! 🗺️</h2>
          <p style={{ marginBottom: "16px" }}>
            Projects combine multiple resources to create interactive maps and
            visualizations.
          </p>
          <p>
            This guided tour will help you understand how to navigate and manage
            your projects effectively.
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
            Use this toggle in the top bar to switch between different trees.
            You're currently in the Projects tree view.
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
            This app manages Projects in a hierarchical folder structure. The
            breadcrumb shows your current location in the hierarchy.
          </p>
          <p style={{ marginTop: 8 }}>
            • Click any breadcrumb item to navigate to that level
          </p>
          <p>
            • Click the icon next to a breadcrumb item to open a context menu
            with operations for that node
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
          <h3>Project Management Toolbar 🔧</h3>
          <p>
            The toolbar above the tree view provides tools to edit and manage
            your projects. You can create folders to organize your projects
            effectively. Features to undo/redo, copy/paste, duplicate/remove,
            and manage trash-bin are available.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[aria-label="Create Action"]',
      content: (
        <div>
          <h3>Quick Actions ⚡</h3>
          <p>Use the floating action button to quickly create new projects:</p>
          <ul style={{ textAlign: "left", paddingLeft: 20 }}>
            <li>Create a new project</li>
            <li>Create folders to organize projects</li>
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
          <h3>Import & Export 📤📥</h3>
          <p>
            In the toolbar, you'll find an import/export button that allows
            you to:
          </p>
          <ul style={{ textAlign: "left", paddingLeft: 20 }}>
            <li>Import projects from ZIP files</li>
            <li>Export your projects to share with others</li>
          </ul>
        </div>
      ),
      placement: "left",
      disableBeacon: true,
    },
  ];

  return (
    <GenericGuidedTour
      run={run}
      onFinish={onFinish}
      steps={steps}
      tourType="projectsTour"
    />
  );
};