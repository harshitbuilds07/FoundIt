
const reportForm = document.getElementById("reportForm");
const message = document.getElementById("message");
const reportsList = document.getElementById("reportsList");
const searchInput = document.getElementById("searchInput");
const photoInput = document.getElementById("itemPhoto");
const submitButton = reportForm.querySelector('button[type="submit"]');

let reports = [];
let editingId = null;

// Load saved reports
try {
  const savedReports = JSON.parse(
    localStorage.getItem("foundItReports")
  );

  if (Array.isArray(savedReports)) {
    reports = savedReports;
  }
} catch (error) {
  reports = [];
}

// Give older reports an ID if they do not have one
reports = reports.map(function(report) {
  return {
    ...report,
    id: report.id || crypto.randomUUID(),
    category: report.category || "",
    reportDate: report.reportDate || "",
    photo: report.photo || ""
  };
});

function showMessage(text, color) {
  message.textContent = text;
  message.style.color = color;
}

function saveReports() {
  try {
    localStorage.setItem(
      "foundItReports",
      JSON.stringify(reports)
    );
    return true;
  } catch (error) {
    showMessage(
      "Could not save. The browser storage may be full.",
      "#d83b50"
    );
    return false;
  }
}

// Save IDs added to older reports
saveReports();

function addTextElement(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);
  return element;
}

function displayReports() {
  reportsList.replaceChildren();

  const searchText = searchInput.value.trim().toLowerCase();

  const filteredReports = reports.filter(function(report) {
    return (
      (report.itemName || "").toLowerCase().includes(searchText) ||
      (report.location || "").toLowerCase().includes(searchText) ||
      (report.category || "").toLowerCase().includes(searchText)
    );
  });

  if (filteredReports.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.textContent = searchText
      ? "No matching reports found. Try another search."
      : "No reports yet. Add the first community report!";

    reportsList.appendChild(emptyMessage);
    return;
  }

  filteredReports.slice().reverse().forEach(function(report) {
    const card = document.createElement("article");
    card.className = "report-card";

    const badge = document.createElement("span");
    badge.className =
      report.type === "Lost" ? "lost-badge" : "found-badge";
    badge.textContent =
      report.type === "Lost" ? "LOST ITEM" : "FOUND ITEM";

    card.appendChild(badge);
    addTextElement(card, "h3", report.itemName || "Unnamed item");

    if (report.photo) {
      const photo = document.createElement("img");
      photo.src = report.photo;
      photo.alt = "Photo of " + (report.itemName || "reported item");
      photo.className = "report-photo";
      photo.loading = "lazy";
      card.appendChild(photo);
    }

    addTextElement(card, "p", "Status: " + (report.type || "Not provided"));
    addTextElement(card, "p", "Category: " + (report.category || "Not provided"));
    addTextElement(card, "p", "Location: " + (report.location || "Not provided"));
    addTextElement(card, "p", "Date: " + (report.reportDate || "Not provided"));

    const actions = document.createElement("div");
    actions.className = "report-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-button";
    editButton.textContent = "✎ Edit";

    editButton.addEventListener("click", function() {
      editReport(report.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "✕ Delete";

    deleteButton.addEventListener("click", function() {
      deleteReport(report.id);
    });

    actions.append(editButton, deleteButton);
    card.appendChild(actions);
    reportsList.appendChild(card);
  });
}

function editReport(id) {
  const report = reports.find(function(item) {
    return item.id === id;
  });

  if (!report) return;

  editingId = id;

  document.getElementById("type").value = report.type || "";
  document.getElementById("itemName").value = report.itemName || "";
  document.getElementById("location").value = report.location || "";
  document.getElementById("category").value = report.category || "";
  document.getElementById("reportDate").value = report.reportDate || "";

  photoInput.value = "";

  submitButton.textContent = "Save Changes →";
  showMessage(
    "Update the details above, then click Save Changes.",
    "#2457e6"
  );

  document.getElementById("report").scrollIntoView({
    behavior: "smooth"
  });
}

function deleteReport(id) {
  const confirmed = confirm(
    "Are you sure you want to delete this report?"
  );

  if (!confirmed) return;

  const previousReports = reports;
  reports = reports.filter(function(report) {
    return report.id !== id;
  });

  if (!saveReports()) {
    reports = previousReports;
    return;
  }

  if (editingId === id) {
    editingId = null;
    reportForm.reset();
    submitButton.textContent = "Submit Report →";
  }

  showMessage("Report deleted successfully.", "#13865b");
  displayReports();
}

searchInput.addEventListener("input", displayReports);

reportForm.addEventListener("submit", function(event) {
  event.preventDefault();

  const type = document.getElementById("type").value;
  const itemName = document.getElementById("itemName").value.trim();
  const location = document.getElementById("location").value.trim();
  const category = document.getElementById("category").value;
  const reportDate = document.getElementById("reportDate").value;
  const file = photoInput.files[0];

  if (!type || !itemName || !location || !category || !reportDate) {
    showMessage("Please fill in all required fields.", "#d83b50");
    return;
  }

  if (file && !file.type.startsWith("image/")) {
    showMessage("Please choose a valid image file.", "#d83b50");
    return;
  }

  if (file && file.size > 700 * 1024) {
    showMessage("Choose a photo smaller than 700 KB.", "#d83b50");
    return;
  }

  // Keep the current photo if editing without uploading a new one
  const oldReport = reports.find(function(report) {
    return report.id === editingId;
  });

  function finishSave(photoData) {
    const reportData = {
      id: editingId || crypto.randomUUID(),
      type: type,
      itemName: itemName,
      location: location,
      category: category,
      reportDate: reportDate,
      photo: file
        ? photoData
        : (oldReport ? oldReport.photo : "")
    };

    const previousReports = reports;

    if (editingId) {
      reports = reports.map(function(report) {
        return report.id === editingId ? reportData : report;
      });
    } else {
      reports.push(reportData);
    }

    if (!saveReports()) {
      reports = previousReports;
      return;
    }

    editingId = null;
    reportForm.reset();
    submitButton.textContent = "Submit Report →";

    displayReports();
    showMessage("Report saved successfully!", "#13865b");
  }

  if (file) {
    const reader = new FileReader();

    reader.onload = function() {
      finishSave(reader.result);
    };

    reader.onerror = function() {
      showMessage("Could not read the selected photo.", "#d83b50");
    };

    reader.readAsDataURL(file);
  } else {
    finishSave("");
  }
});

displayReports();
