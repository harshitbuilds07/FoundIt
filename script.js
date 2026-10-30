
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

// Cloudinary settings
const CLOUD_NAME = "ded2ycbp";
const UPLOAD_PRESET = "foundit_upload";

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

// Upload image to Cloudinary
async function uploadPhoto(file) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || "Photo upload failed.");
  }

  return result.secure_url;
}

// Sign in anonymously
auth.signInAnonymously().catch(function(error) {
  console.error(error);
  showMessage("Sign-in failed. Please refresh and try again.", "#d83b50");
});

// Listen for signed-in user and database changes
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

    // Show uploaded photo
    if (report.photoUrl) {
      const photo = document.createElement("img");
      photo.src = report.photoUrl;
      photo.alt = report.itemName || "Reported item";
      photo.loading = "lazy";
      photo.style.width = "100%";
      photo.style.maxHeight = "250px";
      photo.style.objectFit = "contain";
      photo.style.borderRadius = "10px";

      card.appendChild(photo);
    }

    const badge = document.createElement("span");
    badge.className =
      report.type === "Lost" ? "lost-badge" : "found-badge";
    badge.textContent =
      report.type === "Lost" ? "LOST ITEM" : "FOUND ITEM";

    card.appendChild(badge);

    addTextElement(card, "h3", report.itemName || "Unnamed item");
    addTextElement(card, "p", "Status: " + (report.type || "Not provided"));
    addTextElement(card, "p", "Category: " + (report.category || "Not provided"));
    addTextElement(card, "p", "Location: " + (report.location || "Not provided"));
    addTextElement(card, "p", "Date: " + (report.reportDate || "Not provided"));

    // Only the report owner can edit or delete it
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

  showMessage(
    "Update the details above, then click Save Changes.",
    "#2457e6"
  );

  document.getElementById("report").scrollIntoView({
    behavior: "smooth"
  });
}

async function deleteReport(id) {
  const confirmed = confirm(
    "Are you sure you want to delete this report?"
  );

  if (!confirmed) return;

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

  const oldReport = editingId
    ? reports.find(function(r) {
        return r.id === editingId;
      })
    : null;

  if (editingId && (!oldReport || oldReport.ownerUid !== currentUser.uid)) {
    showMessage("You can only edit your own report.", "#d83b50");
    return;
  }

  submitButton.disabled = true;

  try {
    let photoUrl = oldReport?.photoUrl || "";

    // Upload new photo if selected
    if (file) {
      showMessage("Uploading photo... Please wait.", "#2457e6");
      photoUrl = await uploadPhoto(file);
    }

    showMessage("Saving report...", "#2457e6");

    const reportData = {
      type: type,
      itemName: itemName,
      location: location,
      category: category,
      reportDate: reportDate,
      photoUrl: photoUrl,
      ownerUid: currentUser.uid,
      createdAt: oldReport
        ? oldReport.createdAt
        : firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingId) {
      await itemsRef.doc(editingId).update(reportData);
    } else {
      await itemsRef.add(reportData);
    }

    editingId = null;
    reportForm.reset();
    submitButton.textContent = "Submit Report →";

    showMessage("Report and photo saved successfully!", "#13865b");

  } catch (error) {
    console.error(error);
    showMessage(
      "Could not save report: " + error.message,
      "#d83b50"
    );
  } finally {
    submitButton.disabled = false;
  }
});
