# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses by entering transactions, categorizing spending, and visualizing distribution through a pie chart. All data is stored in the browser's Local Storage — no backend or account required. The app runs as a standalone web page and can also be used as a browser extension.

## Glossary

- **App**: The Expense & Budget Visualizer web application
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category
- **Category**: One of three predefined spending labels: Food, Transport, or Fun
- **Transaction_List**: The scrollable UI component that displays all recorded transactions
- **Input_Form**: The UI form through which users enter new transaction data
- **Balance_Display**: The UI element at the top of the App showing the running total of all transaction amounts
- **Chart**: The pie chart component that visualizes spending distribution across categories
- **Local_Storage**: The browser's built-in Web Storage API used to persist transaction data client-side
- **Chart_Library**: A third-party charting library (e.g., Chart.js) loaded via CDN for rendering the Chart

---

## Requirements

### Requirement 1: Transaction Entry via Input Form

**User Story:** As a user, I want to enter expense details through a form, so that I can record my spending quickly without a complex setup.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for item name with a maximum length of 100 characters, a numeric field for amount accepting values between 0.01 and 999999.99, and a dropdown selector with exactly the options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled and a valid positive amount, THE App SHALL add the transaction to the Transaction_List and persist it to Local_Storage within 500 milliseconds.
3. WHEN the user submits the Input_Form with one or more empty fields, THE Input_Form SHALL display an inline validation message adjacent to each empty field identifying it as required and SHALL NOT add a transaction to the Transaction_List.
4. WHEN the user submits the Input_Form with an amount that is not a number between 0.01 and 999999.99, THE Input_Form SHALL display an inline validation message adjacent to the amount field indicating the valid range and SHALL NOT add a transaction to the Transaction_List.
5. WHEN a transaction is successfully added, THE Input_Form SHALL reset all fields to their default empty or unselected state within 500 milliseconds so the user can enter the next transaction.
6. IF Local_Storage is unavailable when the App attempts to persist a transaction, THEN THE App SHALL display an inline error message indicating the transaction could not be saved and SHALL NOT add the transaction to the Transaction_List.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see all my recorded transactions in a list, so that I can review my spending history at a glance.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each transaction showing its item name, its amount formatted with a currency symbol prefix and exactly two decimal places (e.g., $12.50), and its category label.
2. WHILE more transactions exist than fit the visible area, THE Transaction_List SHALL be scrollable so all entries remain accessible.
3. WHEN the App loads, THE Transaction_List SHALL render all transactions previously persisted in Local_Storage with the most recently added entry appearing at the top.
4. THE Transaction_List SHALL display transactions in reverse insertion order, with the most recently added entry at the top.
5. IF Local_Storage contains no transactions on App load, THEN THE Transaction_List SHALL display a message indicating that no transactions have been recorded.

---

### Requirement 3: Delete a Transaction

**User Story:** As a user, I want to remove individual transactions from the list, so that I can correct mistakes or remove outdated entries.

#### Acceptance Criteria

1. THE Transaction_List SHALL render a delete control (e.g., button or icon) for each transaction entry.
2. WHEN the user activates the delete control for a transaction, THE App SHALL remove that transaction from the Transaction_List and delete it from Local_Storage within the same render cycle.
3. WHEN a transaction is deleted, THE Balance_Display and THE Chart SHALL update immediately within the same render cycle to reflect the removal without requiring a page reload.
4. IF Local_Storage is unavailable when the App attempts to delete a transaction, THEN THE App SHALL display an inline error message indicating the deletion could not be persisted and SHALL retain the transaction in the Transaction_List.

---

### Requirement 4: Total Balance Display

**User Story:** As a user, I want to see my total spending balance at the top of the page, so that I always know my cumulative expense at a glance.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts formatted with a dollar sign, thousands separator, and exactly 2 decimal places (e.g., $1,234.56), with negative totals prefixed by a minus sign (e.g., -$50.00).
2. WHEN the App loads, THE Balance_Display SHALL calculate and show the total from all transactions stored in Local_Storage.
3. WHEN a transaction is added or deleted, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
4. WHILE no transactions have been recorded, THE Balance_Display SHALL show a zero balance of $0.00.
5. IF Local_Storage is unavailable or unreadable on App load, THEN THE Balance_Display SHALL show $0.00 and display an error message indicating that stored data could not be retrieved.

---

### Requirement 5: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart showing how my spending is distributed across categories, so that I can understand my spending habits visually.

#### Acceptance Criteria

1. THE Chart SHALL render as a pie chart displaying each category (Food, Transport, Fun) that has a total transaction amount greater than zero as a proportional segment, where each segment size reflects that category's sum as a fraction of the total sum across all categories.
2. WHEN the App loads with existing transactions in Local_Storage, THE Chart SHALL render immediately reflecting the stored data.
3. WHEN a transaction is added or deleted, THE Chart SHALL update automatically to reflect the new category totals without requiring a page reload.
4. WHILE no transactions have been recorded, THE Chart SHALL display a placeholder state — a single non-segmented visual element with a label indicating no data — rather than rendering segments or throwing an error.
5. THE Chart SHALL use the Chart_Library loaded via CDN to render the pie chart.
6. THE Chart SHALL include a legend or label for each rendered segment that identifies the category by name and displays its percentage of the total spending, rounded to one decimal place.

---

### Requirement 6: Data Persistence

**User Story:** As a user, I want my transaction data to be saved between sessions, so that I do not lose my history when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL serialize and write the updated transaction list to Local_Storage within 100 milliseconds.
2. WHEN a transaction is deleted, THE App SHALL update and write the revised transaction list to Local_Storage within 100 milliseconds.
3. WHEN the App loads, THE App SHALL read all transactions from Local_Storage and restore the Transaction_List, Balance_Display, and Chart to reflect the saved state.
4. IF the data read from Local_Storage on App load is malformed or cannot be parsed, THEN THE App SHALL discard the corrupted data, initialize the App in an empty state, and display a non-blocking visible banner indicating that previously saved data could not be loaded.
5. IF Local_Storage is unavailable, THEN THE App SHALL display a non-blocking visible banner informing the user that data cannot be saved, display at most one such banner per session, and continue operating with in-memory data for the current session.

---

### Requirement 7: Responsive and Accessible UI

**User Story:** As a user, I want the interface to be easy to read and use on both desktop and mobile viewports, so that I can manage expenses from any device.

#### Acceptance Criteria

1. THE App SHALL use a single CSS file for all visual styling, with no inline styles applied to HTML elements.
2. THE App SHALL use a single JavaScript file for all application logic, with no other script files loaded at runtime.
3. THE App SHALL render a usable layout at viewport widths from 320px to 1920px, displaying all primary sections in a single-column stack at viewport widths ≤480px, with no horizontal scrollbar present at any supported width, and all interactive controls having a minimum touch target size of 44×44px.
4. THE App SHALL apply a visual hierarchy where each of the Input_Form, Balance_Display, Transaction_List, and Chart sections is separated from adjacent sections by a visible heading or bounding container, such that the boundary between any two sections is identifiable without interaction.
5. THE Input_Form controls SHALL each have a label element whose text describes the field's purpose, with the label programmatically associated with its control so the association is determinable without visual inspection.
6. THE App SHALL load and render all primary content within 2 seconds when total page asset size does not exceed 1MB, measured from navigation start to the point where all primary sections are visible and interactive.
