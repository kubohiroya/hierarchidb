# HierarchiDB User Manual

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Navigation](#navigation)
4. [Working with Trees](#working-with-trees)
5. [Node Management](#node-management)
6. [Available Plugins](#available-plugins)
7. [User Interface Features](#user-interface-features)
8. [Tips and Best Practices](#tips-and-best-practices)

## Introduction

HierarchiDB is a high-performance tree-structured data management application designed for browser environments. It provides a hierarchical organization system for managing various types of data through an intuitive web interface.

### Key Features
- **Tree-based Organization**: Organize your data in hierarchical tree structures
- **Plugin System**: Extend functionality with specialized node types
- **Real-time Updates**: Changes are reflected immediately across the interface  
- **High Performance**: Handles large datasets efficiently with virtual scrolling
- **Cross-platform**: Works in any modern web browser

## Getting Started

### Accessing the Application

1. **Open your web browser** and navigate to the HierarchiDB application URL
2. **Login** (if authentication is required) using the user login button in the top-right corner
3. **Select a tree** from the main page to start working with your data

### First-Time Setup

When you first access HierarchiDB, you'll see:
- **Resources Tree (R)**: For managing resource-type data
- **Projects Tree (P)**: For managing project-related information

Click on either button to enter the corresponding tree view.

## Navigation

### Main Navigation Elements

- **Tree Toggle Buttons**: Switch between different trees (Resources/Projects)
- **Breadcrumb Navigation**: Shows your current location in the tree hierarchy
- **Toolbar**: Access common actions and tools
- **Info Button (ⓘ)**: Access application information and help
- **GitHub Link**: Link to the project repository (if available)

### URL Structure

HierarchiDB uses a structured URL system:
- `/` - Main page with tree selection
- `/t/{treeId}` - Tree root view
- `/t/{treeId}/{pageNodeId}` - Specific node view
- `/info` - Application information page

## Working with Trees

### Tree Structure

- **Root Node**: The top-level node of each tree
- **Parent Nodes**: Nodes that contain child nodes
- **Leaf Nodes**: Nodes without children
- **Trash**: Special container for deleted items

### Tree Views

1. **Tree Table**: Main view showing nodes in a hierarchical table format
2. **Node Details**: Detailed view of individual node properties
3. **Breadcrumb**: Navigation path showing your current location

### Basic Operations

- **Expand/Collapse**: Click the triangle icon to expand or collapse nodes
- **Navigate**: Click on node names to navigate deeper into the hierarchy
- **Select**: Click to select nodes for actions
- **Multi-select**: Use Ctrl/Cmd+click for multiple selections

## Node Management

### Node Types

HierarchiDB supports different types of nodes through its plugin system:

- **Folder**: Basic container nodes for organization
- **Project**: Project-specific nodes with enhanced metadata
- **Shape**: Geographic shape data (if Shape plugin is available)
- **Spreadsheet**: Tabular data nodes (if Spreadsheet plugin is available)

### Node Operations

#### Creating Nodes
1. Navigate to the parent location
2. Use the **Speed Dial** or **Toolbar** to access create options
3. Select the desired node type
4. Fill in the required information
5. Save to create the node

#### Editing Nodes
1. Select the node you want to edit
2. Open the node dialog/panel
3. Modify the desired properties
4. Save changes

#### Deleting Nodes
1. Select the node(s) to delete
2. Use the delete action from the toolbar or context menu
3. Confirm the deletion
4. Deleted items move to the Trash

#### Moving Nodes
- **Drag and Drop**: Drag nodes to new locations
- **Cut and Paste**: Use keyboard shortcuts (Ctrl+X, Ctrl+V)
- **Batch Operations**: Move multiple nodes at once

## Available Plugins

### Folder Plugin
- **Purpose**: Basic folder organization
- **Features**: Simple container nodes for grouping content
- **Use Cases**: General organization, category creation

### Project Plugin  
- **Purpose**: Project management
- **Features**: Enhanced metadata, project-specific properties
- **Use Cases**: Managing projects, tracking project information

### Shape Plugin (if available)
- **Purpose**: Geographic shape data management
- **Features**: Map integration, geographic visualization
- **Use Cases**: Managing geographic boundaries, spatial data

### Spreadsheet Plugin (if available)
- **Purpose**: Tabular data management
- **Features**: Spreadsheet-like interface for structured data
- **Use Cases**: Data tables, structured information

## User Interface Features

### Tree Console Components

1. **Breadcrumb Bar**: Shows navigation path
2. **Toolbar**: Access to common actions and tools
3. **Tree Table**: Main data display with virtual scrolling
4. **Speed Dial**: Quick access to create actions
5. **Footer**: Status information and additional controls
6. **Trash Bin**: Access deleted items

### Keyboard Shortcuts

- **Arrow Keys**: Navigate between nodes
- **Enter**: Open/edit selected node
- **Delete**: Delete selected node(s)
- **Ctrl+Z**: Undo last action
- **Ctrl+Y**: Redo last action
- **Ctrl+A**: Select all visible nodes
- **Ctrl+C**: Copy selected nodes
- **Ctrl+V**: Paste nodes
- **Ctrl+X**: Cut selected nodes

### Search and Filter

- Use the search bar to find nodes by name
- Filters help narrow down large datasets
- Search results update in real-time as you type

### Context Menus

Right-click on nodes or tree areas to access:
- Create new nodes
- Edit existing nodes
- Copy/paste operations
- Delete operations
- Node-specific actions

## Tips and Best Practices

### Performance Optimization

1. **Use Hierarchical Organization**: Keep tree depth reasonable for better performance
2. **Batch Operations**: Perform multiple operations together when possible
3. **Regular Cleanup**: Use the Trash to remove unnecessary items
4. **Monitor Memory**: Check the memory usage indicator in the footer

### Data Organization

1. **Consistent Naming**: Use clear, consistent naming conventions
2. **Logical Grouping**: Group related items under common parent nodes
3. **Appropriate Depth**: Avoid overly deep hierarchies (recommended: 5-7 levels max)
4. **Use Plugins**: Choose appropriate node types for your content

### Navigation Efficiency

1. **Use Breadcrumbs**: Navigate up the hierarchy quickly
2. **Bookmark Frequently Used Locations**: Use browser bookmarks for deep tree paths
3. **Session Storage**: The application remembers your last location in each tree
4. **Keyboard Navigation**: Learn keyboard shortcuts for faster operation

### Troubleshooting

#### Common Issues

**Application Won't Load**
- Check your internet connection
- Try refreshing the page (F5)
- Clear browser cache if necessary

**Tree Data Not Appearing**
- Ensure you have proper permissions
- Try logging out and back in
- Check the console for error messages

**Performance Issues**
- Close other browser tabs to free memory
- Use filters to limit visible data
- Consider breaking large trees into smaller subtrees

#### Getting Help

- Click the **Info button (ⓘ)** for application information
- Check the GitHub repository for documentation and issues
- Contact your system administrator for access issues

### Browser Compatibility

HierarchiDB works best with modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

For optimal experience, ensure JavaScript is enabled and your browser is up to date.

---

*This manual covers the core functionality of HierarchiDB. Additional features may be available depending on your specific installation and plugin configuration.*