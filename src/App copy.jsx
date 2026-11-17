
import { useState, useEffect } from "react";
import "./App.css";

// DATABASE
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("JewelleryPhotosDB", 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// SAVE PHOTO
async function savePhoto(photo) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").put(photo);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

// GET PHOTOS
async function getFolderPhotos(folderId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readonly");
    const request = tx.objectStore("photos").getAll();

    request.onsuccess = () => {
      const result = request.result.filter(
        photo => photo.folderId === folderId
      );

      db.close();
      resolve(result);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// GET ALL PHOTOS
async function getAllPhotos() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readonly");
    const request = tx.objectStore("photos").getAll();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// DELETE ALL PHOTOS
async function clearAllPhotos() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").clear();

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

// DELETE PHOTO
async function removePhoto(photoId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").delete(photoId);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function App() {
  const [folders, setFolders] = useState(() => {
    return JSON.parse(localStorage.getItem("jewelleryFolders")) || [
      { id: 1, name: "Jhumka" },
      { id: 2, name: "Necklace" },
      { id: 3, name: "Bangles" },
      { id: 4, name: "Rings" }
    ];
  });

  const [newFolder, setNewFolder] = useState("");
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [folderPhotoCounts, setFolderPhotoCounts] = useState({});
  const [showFavourites, setShowFavourites] = useState(false);
  const [goldRate, setGoldRate] = useState(
  localStorage.getItem("goldRate") || ""
);

const [silverRate, setSilverRate] = useState(
  localStorage.getItem("silverRate") || ""
);

  useEffect(() => {
    localStorage.setItem("jewelleryFolders", JSON.stringify(folders));
  }, [folders]);
  useEffect(() => {
  localStorage.setItem("goldRate", goldRate);
  localStorage.setItem("silverRate", silverRate);
}, [goldRate, silverRate]);
  // LOAD PHOTO COUNTS
useEffect(() => {
  async function loadPhotoCounts() {
    try {
      const allPhotos = await getAllPhotos();

      const counts = {};

      folders.forEach(folder => {
        counts[folder.id] = allPhotos.filter(
          photo => photo.folderId === folder.id
        ).length;
      });

      setFolderPhotoCounts(counts);
    } catch (error) {
      console.log("Unable to load photo counts");
    }
  }

  if (!selectedFolder) {
    loadPhotoCounts();
  }
}, [folders, selectedFolder]);

  // BACKUP COLLECTION
async function backupCollection() {
  try {
    const allPhotos = await getAllPhotos();

    const backupData = {
      folders: folders,
      photos: allPhotos
    };

    const blob = new Blob(
      [JSON.stringify(backupData)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "Jewellery-Collection-Backup.json";
    link.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    alert("Backup failed!");
  }
}

// RESTORE COLLECTION
async function restoreCollection(event) {
  const file = event.target.files[0];

  if (!file) return;

  try {
    const text = await file.text();
    const backupData = JSON.parse(text);

    if (
      !Array.isArray(backupData.folders) ||
      !Array.isArray(backupData.photos)
    ) {
      alert("Invalid backup file!");
      return;
    }

    const confirmRestore = window.confirm(
      "Current collection will be replaced after storing. Want to Continue?"
    );

    if (!confirmRestore) return;

    await clearAllPhotos();

    for (const photo of backupData.photos) {
      await savePhoto(photo);
    }

    setFolders(backupData.folders);
    localStorage.setItem(
      "jewelleryFolders",
      JSON.stringify(backupData.folders)
    );

    setSelectedFolder(null);
    setPhotos([]);

    alert("Collection restored successfully!");
  } catch (error) {
    alert("Restore failed! Please select a valid backup.");
  } finally {
    event.target.value = "";
  }
}


  // OPEN FOLDER
  async function openFolder(folder) {
    setSelectedFolder(folder);

    try {
      const savedPhotos = await getFolderPhotos(folder.id);
      setPhotos(savedPhotos);
    } catch (error) {
      alert("Unable to load photos");
    }
  }

  // CREATE FOLDER
  function addFolder() {
    if (!newFolder.trim()) {
      alert("Please enter folder name");
      return;
    }

    if (
      folders.some(
        f => f.name.toLowerCase() === newFolder.trim().toLowerCase()
      )
    ) {
      alert("Folder already exists!");
      return;
    }

    setFolders([
      ...folders,
      { id: Date.now(), name: newFolder.trim() }
    ]);

    setNewFolder("");
  }

  // RENAME FOLDER
  function renameFolder(id) {
    const folder = folders.find(f => f.id === id);
    const name = prompt("Enter new folder name:", folder.name);

    if (
      name &&
      name.trim() &&
      !folders.some(
        f => f.id !== id &&
        f.name.toLowerCase() === name.trim().toLowerCase()
      )
    ) {
      setFolders(folders.map(f =>
        f.id === id ? { ...f, name: name.trim() } : f
      ));
    }
  }

  // DELETE FOLDER
  async function deleteFolder(id) {
    if (!window.confirm("Delete this folder and all its photos?")) {
      return;
    }

    const savedPhotos = await getFolderPhotos(id);

    for (const photo of savedPhotos) {
      await removePhoto(photo.id);
    }

    setFolders(folders.filter(f => f.id !== id));

    if (selectedFolder?.id === id) {
      setSelectedFolder(null);
      setPhotos([]);
    }
  }

  // ADD PHOTOS
  async function addPhotos(event) {
    const files = Array.from(event.target.files || []);

    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;

        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await savePhoto({
          id: `${selectedFolder.id}-${crypto.randomUUID()}`,
          folderId: selectedFolder.id,
          name: file.name,
          data: dataUrl
        });
      }

      setPhotos(await getFolderPhotos(selectedFolder.id));
    } catch (error) {
      alert("Unable to save photos. Please try smaller images.");
    }

    event.target.value = "";
  }

  // DELETE IMAGE
  async function deleteImage(id) {
    if (!window.confirm("Delete this photo?")) return;

    await removePhoto(id);
    setPhotos(await getFolderPhotos(selectedFolder.id));
  }

  // TOGGLE FAVOURITE
async function toggleFavourite(photo) {
  const updatedPhoto = {
    ...photo,
    favourite: !photo.favourite
  };

  await savePhoto(updatedPhoto);

  if (showFavourites) {
  const allPhotos = await getAllPhotos();
  setPhotos(allPhotos.filter(p => p.favourite));
} else {
  setPhotos(await getFolderPhotos(selectedFolder.id));
}
}

// OPEN FAVOURITES
async function openFavourites() {
  const allPhotos = await getAllPhotos();

  const favouritePhotos = allPhotos.filter(
    photo => photo.favourite === true
  );

  setPhotos(favouritePhotos);
  setSelectedFolder(null);
  setShowFavourites(true);
}


async function renamePhoto(photoId) {
  const photo = photos.find(p => p.id === photoId);

  if (!photo) return;

  const newName = prompt("Enter new photo name:", photo.name);

  if (!newName || !newName.trim()) return;

  await savePhoto({
    ...photo,
    name: newName.trim()
  });

  setPhotos(await getFolderPhotos(selectedFolder.id));
}

async function editPhotoDetails(photoId) {
  const photo = photos.find(p => p.id === photoId);

  if (!photo) return;

  const price = prompt("Enter jewellery price:", photo.price || "");
  if (price === null) return;

  const weight = prompt("Enter weight in grams:", photo.weight || "");
  if (weight === null) return;

  const purity = prompt("Enter purity (22K, 18K, 24K):", photo.purity || "");
  if (purity === null) return;

  const description = prompt("Enter description:", photo.description || "");
  if (description === null) return;

  await savePhoto({
    ...photo,
    price,
    weight,
    purity,
    description
  });

  if (showFavourites) {
    const allPhotos = await getAllPhotos();
    setPhotos(allPhotos.filter(p => p.favourite));
  } else {
    setPhotos(await getFolderPhotos(selectedFolder.id));
  }

  alert("Jewellery details saved successfully!");
}


  // REPLACE IMAGE
  async function replacePhoto(event, photoId) {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image");
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const oldPhoto = photos.find(p => p.id === photoId);

      if (!oldPhoto) return;

      await savePhoto({
        ...oldPhoto,
        name: file.name,
        data: dataUrl
      });

      setPhotos(await getFolderPhotos(selectedFolder.id));
    } catch (error) {
      alert("Unable to replace photo");
    }

    event.target.value = "";
  }

  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app">

      <header className="header">
        <div className="logo">💎 Jewellery Collection</div>
        <span className="shop">MY SHOP</span>
        <div className="metal-rates">
  <div className="rate-box">
    <span>💛 GOLD RATE</span>
    <strong>₹{goldRate || "Enter Rate"}</strong>
    <small>Per 10 Gram</small>
    <button onClick={() => {
      const rate = prompt("Enter Gold Rate per 10 Gram:", goldRate);
      if (rate !== null && rate.trim() !== "") {
        setGoldRate(rate);
      }
    }}>
      Edit Rate
    </button>
  </div>

  <div className="rate-box">
    <span>🤍 SILVER RATE</span>
    <strong>₹{silverRate || "Enter Rate"}</strong>
    <small>Per 10 Gram</small>
    <button onClick={() => {
      const rate = prompt("Enter Silver Rate per 10 Gram:", silverRate);
      if (rate !== null && rate.trim() !== "") {
        setSilverRate(rate);
      }
    }}>
      Edit Rate
    </button>
  </div>
</div>
      </header>

      <main className="main">

        {!selectedFolder && !showFavourites ? (
          <>
            <div className="welcome">
              <p className="small-heading">
                YOUR DIGITAL JEWELLERY CATALOGUE
              </p>

              <h1>My Jewellery Collection</h1>

              <p>Organize all your jewellery photos in one place.</p>
            </div>

            <div className="toolbar">

              <input
                placeholder="Search categories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div className="add-box">

                <input
                  placeholder="Enter new category name"
                  value={newFolder}
                  onChange={e => setNewFolder(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addFolder()}
                />

                <button onClick={addFolder}>
                  + Create Folder
                </button>

              </div>
            </div>

            <div className="section-title">
              <h2>My Categories</h2>
              <span>{folders.length} Folders</span>
            </div>
            <button onClick={openFavourites}>
  ❤️ My Favourites
</button>
            {/* BACKUP AND RESTORE BUTTONS */}
<div
  className="backup-buttons"
  style={{
    display: "flex",
    gap: "12px",
    marginBottom: "25px",
    alignItems: "center"
  }}
>
  <button onClick={backupCollection}>
    Download Backup
  </button>

  <label
    htmlFor="restoreBackup"
    className="restore-btn"
    style={{
      padding: "12px 20px",
      background: "#f3e7df",
      color: "#80513d",
      borderRadius: "8px",
      cursor: "pointer"
    }}
  >
    Restore Backup
  </label>

  <input
    type="file"
    id="restoreBackup"
    accept=".json,application/json"
    onChange={restoreCollection}
    style={{ display: "none" }}
  />
</div>

<div className="folder-grid">
              {filteredFolders.map(folder => (
                <div className="folder-card" key={folder.id}>

                  <div className="folder-icon">📁</div>

                  <h3>{folder.name}</h3>

                  <p>
  {folderPhotoCounts[folder.id] || 0} Photos
</p>

                  <div className="actions">

                    <button onClick={() => renameFolder(folder.id)}>
                      Edit Name
                    </button>

                    <button
                      className="delete"
                      onClick={() => deleteFolder(folder.id)}
                    >
                      Delete
                    </button>

                  </div>

                  

                  <button
                    className="open-folder"
                    onClick={() => openFolder(folder)}
                  >
                    Open Folder →
                  </button>

                </div>
              ))}

            </div>

            {filteredFolders.length === 0 && (
              <p className="empty">No categories found.</p>
            )}
          </>
        ) : showFavourites ? (
  <>
    <button onClick={() => {
      setShowFavourites(false);
      setPhotos([]);
    }}>
      ← Back to Categories
    </button>

    <div className="welcome">
      <h1>❤️ My Favourites</h1>
      <p>Your favourite jewellery collection</p>
    </div>

    {photos.length === 0 ? (
      <p className="empty">No favourite photos yet!</p>
    ) : (
      <div className="folder-grid">
        {photos.map(photo => (
          <div className="folder-card" key={photo.id}>
            <img
              src={photo.data}
              alt={photo.name}
              onClick={() => setPreviewPhoto(photo)}
              style={{
                width: "100%",
                height: "190px",
                objectFit: "contain",
                borderRadius: "8px"
              }}
            />

            <p>{photo.name}</p>


            <button
              className="favorite-button"
              onClick={() => toggleFavourite(photo)}
            >
              ❤️ Remove Favourite
            </button>
          </div>
        ))}
      </div>
    )}
  </>
) : (
  <>
   <button
  className="back-button"
  onClick={() => setSelectedFolder(null)}
>
  ← Back to Categories
</button>

            <div className="welcome">
              <h1>📁 {selectedFolder.name}</h1>
              <p>Your jewellery photos collection</p>
            </div>

            <label className="upload-button" htmlFor="photoUpload">
              + Add Jewellery Photos
            </label>

            <input
              id="photoUpload"
              type="file"
              accept="image/*"
              multiple
              onChange={addPhotos}
              style={{ display: "none" }}
            />

            <div className="section-title">
              <h2>My Photos</h2>
              <span>{photos.length} Photos</span>
            </div>

            {photos.length === 0 ? (
              <p className="empty">
                No photos yet. Add your first photo!
              </p>
            ) : (
              <div className="folder-grid">

                {photos.map(photo => (
                  <div className="folder-card" key={photo.id}>

                    <img
                      src={photo.data}
                      alt={photo.name}
                      onClick={() => setPreviewPhoto(photo)}
                      style={{
                        width: "100%",
                        height: "190px",
                        objectFit: "contain",
                        borderRadius: "8px"
                      }}
                    />

                    <p>{photo.name}</p>
                    {photo.price && <p>💰 Price: ₹{photo.price}</p>}
{photo.weight && <p>⚖️ Weight: {photo.weight} g</p>}
{photo.purity && <p>✨ Purity: {photo.purity}</p>}
{photo.description && <p>📝 {photo.description}</p>}
                    <button
  className="favorite-button"
  onClick={() => toggleFavourite(photo)}
>
  {photo.favourite ? "❤️ Remove Favourite" : "♡ Add to Favourites"}
</button>
<div className="photo-actions">

  <button onClick={() => renamePhoto(photo.id)}>
    Edit Photo Name
  </button>

  <button onClick={() => editPhotoDetails(photo.id)}>
  Edit Details
</button>

  <button
    className="delete"
    onClick={() => deleteImage(photo.id)}
  >
    Delete Photo
  </button>

  <label
    htmlFor={`replace-${photo.id}`}
    className="replace-button"
  >
    Replace Photo
  </label>

</div>

<input
  id={`replace-${photo.id}`}
  type="file"
  accept="image/*"
  style={{ display: "none" }}
  onChange={e => replacePhoto(e, photo.id)}
/>

                  </div>
                ))}

              </div>
            )}
          </>
        )}

      </main>

{previewPhoto && (
  <div
    onClick={() => setPreviewPhoto(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.9)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      zIndex: 9999,
      padding: "20px",
      cursor: "pointer"
    }}
  >
    <button
      onClick={() => setPreviewPhoto(null)}
      style={{
        position: "absolute",
        top: "20px",
        right: "25px",
        fontSize: "25px",
        background: "white",
        border: "none",
        borderRadius: "50%",
        width: "45px",
        height: "45px",
        cursor: "pointer"
      }}
    >
      
    </button>

    <img
      src={previewPhoto.data}
      alt={previewPhoto.name}
      onClick={e => e.stopPropagation()}
      style={{
        maxWidth: "90%",
        maxHeight: "80vh",
        objectFit: "contain",
        borderRadius: "10px"
      }}
    />

    <p style={{ color: "white", marginTop: "15px" }}>
      {previewPhoto.name}
    </p>
  </div>
)}

      <footer>Jewellery Collection Manager © 2026</footer>

    </div>
  );
}

export default App;
