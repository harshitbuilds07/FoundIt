
const reportForm = document.getElementById("reportForm");
const message = document.getElementById("message");
const reportsList = document.getElementById("reportsList");
const searchInput = document.getElementById("searchInput");
const photoInput = document.getElementById("itemPhoto");
const submitButton = reportForm.querySelector('button[type="submit"]');

let reports = [];
let editingId = null;
let currentUser = null;
let unsubscribeReports = null;

const itemsRef = db.collection("items");

function showMessage(text, color) {
  message.textContent = text;
  message.style.color = color;
}

function addTextElement(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

// Anonymous login
auth.signInAnonymously().catch(function(error) {
  console.error(error);
  showMessage("Sign-in failed. Please refresh.", "#d83b50");
});

// Listen for login and reports
auth.onAuthStateChanged(function(user) {
  if (!user) return;

  currentUser = user;

  if (unsubscribeReports) unsubscribeReports();

  unsubscribeReports = itemsRef
    .orderBy("createdAt", "desc")
    .onSnapshot(function(snapshot) {
      reports = snapshot.docs.map(function(doc) {
        return {
          id: doc.id,
          ...doc.data()
        };
      });
      displayReports();
    }, function(error) {
      console.error(error);
      showMessage("Could not load reports. Check Firestore rules.", "#d83b50");
    });
});

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

  filteredReports.forEach(function(report) {
    const card = document.createElement("article");
    card.className = "report-card";

    const badge = document.createElement("span");
    badge.className = report.type === "Lost" ? "lost-badge" : "found-badge";
    badge.textContent = report.type === "Lost" ? "LOST ITEM" : "FOUND ITEM";

    card.appendChild(badge);
    addTextElement(card, "h3", report.itemName || "Unnamed item");
    addTextElement(card, "p", "Status: " + (report.type || "Not provided"));
    addTextElement(card, "p", "Category: " + (report.category || "Not provided"));
    addTextElement(card, "p", "Location: " + (report.location || "Not provided"));
    addTextElement(card, "p", "Date: " + (report.reportDate || "Not provided"));

    if (currentUser && report.ownerUid === currentUser.uid) {
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
    }

    reportsList.appendChild(card);
  });
}

function editReport(id) {
  const report = reports.find(function(item) {
    return item.id === id;
  });

  if (!report || report.ownerUid !== currentUser.uid) return;

  editingId = id;

  document.getElementById("type").value = report.type || "";
  document.getElementById("itemName").value = report.itemName || "";
  document.getElementById("location").value = report.location || "";
  document.getElementById("category").value = report.category || "";
  document.getElementById("reportDate").value = report.reportDate || "";

  photoInput.value = "";
  submitButton.textContent = "Save Changes →";

  showMessage("Update the details above, then click Save Changes.", "#2457e6");

  document.getElementById("report").scrollIntoView({
    behavior: "smooth"
  });
}

async function deleteReport(id) {
  if (!confirm("Are you sure you want to delete this report?")) return;

  try {
    await itemsRef.doc(id).delete();

    if (editingId === id) {
      editingId = null;
      reportForm.reset();
      submitButton.textContent = "Submit Report →";
    }

    showMessage("Report deleted successfully.", "#13865b");
  } catch (error) {
    console.error(error);
    showMessage("Could not delete this report.", "#d83b50");
  }
}

searchInput.addEventListener("input", displayReports);

reportForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  if (!currentUser) {
    showMessage("Please wait. Connecting to Firebase...", "#2457e6");
    return;
  }

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

  const reportData = {
    type: type,
    itemName: itemName,
    location: location,
    category: category,
    reportDate: reportDate,
    ownerUid: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  submitButton.disabled = true;

  try {
    if (editingId) {
      const oldReport = reports.find(function(r) {
        return r.id === editingId;
      });

      if (!oldReport || oldReport.ownerUid !== currentUser.uid) {
        throw new Error("You can only edit your own report.");
      }

      reportData.createdAt = oldReport.createdAt;
      await itemsRef.doc(editingId).update(reportData);
    } else {
      await itemsRef.add(reportData);
    }

    editingId = null;
    reportForm.reset();
    submitButton.textContent = "Submit Report →";

    showMessage(
      file
        ? "Report saved. Photo upload is not available yet."
        : "Report saved successfully!",
      "#13865b"
    );
  } catch (error) {
    console.error(error);
    showMessage("Could not save report. Please try again.", "#d83b50");
  } finally {
    submitButton.disabled = false;
  }
});
