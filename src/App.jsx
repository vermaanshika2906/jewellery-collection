
import { useState, useEffect } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => console.log("Service Worker Registered"))
      .catch((error) => console.log("Service Worker Error:", error));
  });
}


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

// GET PHOTOS FROM ONE FOLDER
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

// DELETE ONE PHOTO
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
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gstNumber, setGstNumber] = useState("");

  const [isCustomer, setIsCustomer] = useState(false);
  const [cloudFolders, setCloudFolders] = useState([]);
  const [cloudPhotos, setCloudPhotos] = useState([]);

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

  // OWNER LOGIN
async function ownerLogin() {
  if (!gstNumber.trim()) {
    alert("Please enter GST Number");
    return;
  }

  if (gstNumber.trim().toUpperCase() !== "06bgjpk4564k1z1") {
    alert("Invalid GST Number");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("Login failed: " + error.message);
    return;
  }

  setUser(data.user);
  setIsCustomer(false);
  setShowLogin(false);
  setPassword("");
  setGstNumber("");
  alert("Owner login successful!");
}

  // CHECK LOGIN SESSION
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user);
        setIsCustomer(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // LOAD GOLD AND SILVER RATES FROM CLOUD
  useEffect(() => {
    let isMounted = true;

    async function loadCloudRates() {
      const { data, error } = await supabase
        .from("jewellery_settings")
        .select("gold_rate, silver_rate")
        .eq("id", "main")
        .maybeSingle();

      if (error) {
        console.log("Rate loading error:", error.message);
        return;
      }

      if (isMounted && data) {
        setGoldRate(data.gold_rate || "");
        setSilverRate(data.silver_rate || "");
      }
    }

    loadCloudRates();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // SAVE GOLD AND SILVER RATES TO CLOUD
  async function saveRatesToCloud(newGoldRate, newSilverRate) {
    if (!user) {
      alert("Please login as owner first!");
      return;
    }

    const { error } = await supabase
      .from("jewellery_settings")
      .upsert(
        {
          id: "main",
          gold_rate: newGoldRate,
          silver_rate: newSilverRate,
          owner_id: user.id
        },
        { onConflict: "id" }
      );

    if (error) {
      alert("Rate cloud sync failed: " + error.message);
    } else {
      alert("Gold and Silver rates saved to cloud!");
    }
  }

  // OWNER LOGOUT
  async function ownerLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("Logout failed: " + error.message);
      return;
    }

    setUser(null);
    setIsCustomer(false);
    setShowLogin(false);
    setSelectedFolder(null);
    setPhotos([]);
    setCloudPhotos([]);
    setShowFavourites(false);
    alert("Logged out successfully!");
  }

  // SYNC FOLDERS TO SUPABASE
  async function syncFoldersToCloud() {
    if (!user) {
      alert("Please login as owner first!");
      return;
    }

    try {
      const { data: cloudFolderList, error: fetchError } = await supabase
        .from("jewellery_folders")
        .select("id, name")
        .eq("owner_id", user.id);

      if (fetchError) throw fetchError;

      for (const folder of folders) {
        const existingFolder = (cloudFolderList || []).find(
          item => item.name.toLowerCase() === folder.name.toLowerCase()
        );

        if (existingFolder) continue;

        const { error } = await supabase
          .from("jewellery_folders")
          .insert({
            name: folder.name,
            owner_id: user.id
          });

        if (error) throw error;
      }

      alert("Folders synced to cloud successfully!");
    } catch (error) {
      alert("Cloud sync failed: " + error.message);
    }
  }

  // SYNC EXISTING LOCAL PHOTOS TO SUPABASE
  async function syncPhotosToCloud() {
    if (!user) {
      alert("Please login as owner first!");
      return;
    }

    try {
      const { data: cloudFolderList, error: folderError } = await supabase
        .from("jewellery_folders")
        .select("id, name")
        .eq("owner_id", user.id);

      if (folderError) throw folderError;

      const { data: existingPhotos, error: photoError } = await supabase
        .from("jewellery_photos")
        .select("local_id")
        .eq("owner_id", user.id);

      if (photoError) throw photoError;

      const uploadedIds = new Set(
        (existingPhotos || []).map(photo => photo.local_id)
      );

      const allPhotos = await getAllPhotos();
      let uploadedCount = 0;

      for (const photo of allPhotos) {
        if (uploadedIds.has(String(photo.id))) continue;

        const localFolder = folders.find(
          folder => folder.id === photo.folderId
        );

        if (!localFolder) continue;

        const cloudFolder = (cloudFolderList || []).find(
          folder =>
            folder.name.toLowerCase() === localFolder.name.toLowerCase()
        );

        if (!cloudFolder) {
          throw new Error("Cloud folder not found: " + localFolder.name);
        }

        const imageBlob = await fetch(photo.data).then(res => res.blob());
        const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("jewellery-photos")
          .upload(filePath, imageBlob, {
            contentType: imageBlob.type || "image/jpeg"
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("jewellery-photos")
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase
          .from("jewellery_photos")
          .insert({
            local_id: String(photo.id),
            folder_id: cloudFolder.id,
            name: photo.name,
            image_url: publicData.publicUrl,
            price: photo.price || null,
            weight: photo.weight || null,
            purity: photo.purity || null,
            description: photo.description || null,
            favourite: photo.favourite || false,
            owner_id: user.id
          });

        if (insertError) throw insertError;
        uploadedCount++;
      }

      alert(uploadedCount + " photos uploaded to cloud successfully!");
    } catch (error) {
      alert("Photo sync failed: " + error.message);
    }
  }

  // LOAD CLOUD FOLDERS AND PHOTOS FOR CUSTOMERS
  async function openCustomerView() {
    try {
      const { data: folderData, error: folderError } = await supabase
        .from("jewellery_folders")
        .select("id, name")
        .order("name");

      if (folderError) throw folderError;

      const { data: photoData, error: photoError } = await supabase
        .from("jewellery_photos")
        .select("id, folder_id, name, image_url, price, weight, purity, description, favourite");

      if (photoError) throw photoError;

      const cloudPhotoList = (photoData || []).map(photo => ({
        ...photo,
        folderId: photo.folder_id,
        data: photo.image_url
      }));

      setCloudFolders(folderData || []);
      setCloudPhotos(cloudPhotoList);
      setSelectedFolder(null);
      setPhotos([]);
      setShowFavourites(false);
      setIsCustomer(true);
    } catch (error) {
      alert("Unable to load cloud collection: " + error.message);
    }
  }

  // SUPABASE CONNECTION TEST
  useEffect(() => {
    supabase
      .from("jewellery_folders")
      .select("id")
      .limit(1)
      .then(({ error }) => {
        if (error) {
          console.log("Supabase Error:", error.message);
        } else {
          console.log("Supabase Connected Successfully!");
        }
      });
  }, []);

  // SAVE FOLDERS LOCALLY
  useEffect(() => {
    localStorage.setItem("jewelleryFolders", JSON.stringify(folders));
  }, [folders]);

  // SAVE RATES LOCALLY AS BACKUP
  useEffect(() => {
    localStorage.setItem("goldRate", goldRate);
    localStorage.setItem("silverRate", silverRate);
  }, [goldRate, silverRate]);

  // LOAD LOCAL PHOTO COUNTS
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
        console.log("Unable to load photo counts:", error);
      }
    }

    if (!selectedFolder) {
      loadPhotoCounts();
    }
  }, [folders, selectedFolder, photos]);

  // BACKUP COLLECTION
  async function backupCollection() {
    try {
      const allPhotos = await getAllPhotos();
      const backupData = { folders, photos: allPhotos };

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
      const fileText = await file.text();
      const backupData = JSON.parse(fileText);

      if (
        !Array.isArray(backupData.folders) ||
        !Array.isArray(backupData.photos)
      ) {
        alert("Invalid backup file!");
        return;
      }

      const confirmRestore = window.confirm(
        "Current collection will be replaced. Want to continue?"
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
      setShowFavourites(false);
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
    setShowFavourites(false);

    try {
      if (isCustomer) {
        const { data, error } = await supabase
          .from("jewellery_photos")
          .select("*")
          .eq("folder_id", folder.id);

        if (error) throw error;

        const cloudPhotoList = (data || []).map(photo => ({
          ...photo,
          folderId: photo.folder_id,
          data: photo.image_url
        }));

        setCloudPhotos(prev => {
          const otherPhotos = prev.filter(
            photo => photo.folderId !== folder.id
          );
          return [...otherPhotos, ...cloudPhotoList];
        });
        setPhotos(cloudPhotoList);
      } else {
        const savedPhotos = await getFolderPhotos(folder.id);
        setPhotos(savedPhotos);
      }
    } catch (error) {
      alert("Unable to load photos: " + error.message);
    }
  }

  // CREATE FOLDER
  async function addFolder() {
    if (!newFolder.trim()) {
      alert("Please enter folder name");
      return;
    }

    const folderName = newFolder.trim();

    if (
      folders.some(
        folder =>
          folder.name.toLowerCase() === folderName.toLowerCase()
      )
    ) {
      alert("Folder already exists!");
      return;
    }

    const newFolderData = {
      id: Date.now(),
      name: folderName
    };

    setFolders(prev => [...prev, newFolderData]);
    setNewFolder("");

    if (user) {
      const { error } = await supabase
        .from("jewellery_folders")
        .insert({
          name: folderName,
          owner_id: user.id
        });

      if (error) {
        alert("Cloud folder save failed: " + error.message);
        console.log(error);
      } else {
        alert("Folder saved successfully to cloud!");
      }
    }
  }

  // RENAME FOLDER
  async function renameFolder(id) {
    const folder = folders.find(item => item.id === id);
    if (!folder) return;

    const name = prompt("Enter new folder name:", folder.name);

    if (!name || !name.trim()) return;

    const newName = name.trim();

    if (
      folders.some(
        item =>
          item.id !== id &&
          item.name.toLowerCase() === newName.toLowerCase()
      )
    ) {
      alert("Folder already exists!");
      return;
    }

    setFolders(prev =>
      prev.map(item =>
        item.id === id ? { ...item, name: newName } : item
      )
    );

    if (user) {
      const { error } = await supabase
        .from("jewellery_folders")
        .update({ name: newName })
        .eq("name", folder.name)
        .eq("owner_id", user.id);

      if (error) {
        alert("Cloud rename failed: " + error.message);
        console.log(error);
      } else {
        alert("Folder renamed successfully in cloud!");
      }
    }
  }

  // DELETE FOLDER
  async function deleteFolder(id) {
    if (!window.confirm("Delete this folder and all its photos?")) {
      return;
    }

    const folder = folders.find(item => item.id === id);
    if (!folder) return;

    if (user) {
      const { data: cloudFolder, error: findError } = await supabase
        .from("jewellery_folders")
        .select("id")
        .eq("name", folder.name)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (findError) {
        alert("Cloud folder search failed: " + findError.message);
        return;
      }

      if (cloudFolder) {
        const { data: cloudPhotos, error: photoError } = await supabase
          .from("jewellery_photos")
          .select("id, image_url")
          .eq("folder_id", cloudFolder.id);

        if (photoError) {
          alert("Cloud photos loading failed: " + photoError.message);
          return;
        }

        if (cloudPhotos?.length) {
          const { error: deletePhotosError } = await supabase
            .from("jewellery_photos")
            .delete()
            .eq("folder_id", cloudFolder.id);

          if (deletePhotosError) {
            alert("Cloud photos delete failed: " + deletePhotosError.message);
            return;
          }

          const storagePaths = cloudPhotos
            .map(photo => {
              const marker = "/storage/v1/object/public/jewellery-photos/";
              const index = photo.image_url?.indexOf(marker);
              return index >= 0
                ? decodeURIComponent(photo.image_url.slice(index + marker.length))
                : null;
            })
            .filter(Boolean);

          if (storagePaths.length) {
            const { error: storageError } = await supabase.storage
              .from("jewellery-photos")
              .remove(storagePaths);

            if (storageError) {
              console.log("Storage cleanup error:", storageError.message);
            }
          }
        }

        const { error: deleteFolderError } = await supabase
          .from("jewellery_folders")
          .delete()
          .eq("id", cloudFolder.id)
          .eq("owner_id", user.id);

        if (deleteFolderError) {
          alert("Cloud folder delete failed: " + deleteFolderError.message);
          return;
        }
      }
    }

    const savedPhotos = await getFolderPhotos(id);
    for (const photo of savedPhotos) {
      await removePhoto(photo.id);
    }

    setFolders(prev => prev.filter(folder => folder.id !== id));

    if (selectedFolder?.id === id) {
      setSelectedFolder(null);
      setPhotos([]);
    }

    alert("Folder deleted successfully!");
  }

  // ADD PHOTOS AND AUTOMATIC CLOUD SYNC
  async function addPhotos(event) {
    const files = Array.from(event.target.files || []);
    if (!selectedFolder) return;

    try {
      let uploadedCount = 0;

      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;

        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const newPhoto = {
          id: `${selectedFolder.id}-${crypto.randomUUID()}`,
          folderId: selectedFolder.id,
          name: file.name,
          data: dataUrl
        };

        await savePhoto(newPhoto);

        if (user) {
          const { data: cloudFolderList, error: folderError } = await supabase
            .from("jewellery_folders")
            .select("id, name")
            .eq("owner_id", user.id);

          if (folderError) throw folderError;

          let cloudFolder = (cloudFolderList || []).find(
            folder =>
              folder.name.toLowerCase() ===
              selectedFolder.name.toLowerCase()
          );

          if (!cloudFolder) {
            const { data: newCloudFolder, error: insertFolderError } =
              await supabase
                .from("jewellery_folders")
                .insert({
                  name: selectedFolder.name,
                  owner_id: user.id
                })
                .select()
                .single();

            if (insertFolderError) throw insertFolderError;
            cloudFolder = newCloudFolder;
          }

          const imageBlob = await fetch(dataUrl).then(res => res.blob());
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from("jewellery-photos")
            .upload(filePath, imageBlob, {
              contentType: imageBlob.type || "image/jpeg"
            });

          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage
            .from("jewellery-photos")
            .getPublicUrl(filePath);

          const { error: insertError } = await supabase
            .from("jewellery_photos")
            .insert({
              local_id: String(newPhoto.id),
              folder_id: cloudFolder.id,
              name: file.name,
              image_url: publicData.publicUrl,
              price: newPhoto.price || null,
              weight: newPhoto.weight || null,
              purity: newPhoto.purity || null,
              description: newPhoto.description || null,
              favourite: newPhoto.favourite || false,
              owner_id: user.id
            });

          if (insertError) throw insertError;
          uploadedCount++;
        }
      }

      setPhotos(await getFolderPhotos(selectedFolder.id));

      if (user) {
        alert(`${uploadedCount} photos saved and uploaded to cloud!`);
      } else {
        alert("Photos saved successfully!");
      }
    } catch (error) {
      alert("Photo upload issue: " + error.message);
      setPhotos(await getFolderPhotos(selectedFolder.id));
    }

    event.target.value = "";
  }

  // DELETE IMAGE (LOCAL + CLOUD)
  async function deleteImage(id) {
    if (!window.confirm("Delete this photo?")) return;

    if (user) {
      const { data: cloudPhoto, error: findError } = await supabase
        .from("jewellery_photos")
        .select("id, image_url")
        .eq("local_id", String(id))
        .eq("owner_id", user.id)
        .maybeSingle();

      if (findError) {
        alert("Cloud photo search failed: " + findError.message);
        return;
      }

      if (cloudPhoto) {
        const { error: deleteError } = await supabase
          .from("jewellery_photos")
          .delete()
          .eq("id", cloudPhoto.id)
          .eq("owner_id", user.id);

        if (deleteError) {
          alert("Cloud photo delete failed: " + deleteError.message);
          return;
        }

        const marker = "/storage/v1/object/public/jewellery-photos/";
        const index = cloudPhoto.image_url?.indexOf(marker);

        if (index >= 0) {
          const imagePath = decodeURIComponent(
            cloudPhoto.image_url.slice(index + marker.length)
          );

          const { error: storageError } = await supabase.storage
            .from("jewellery-photos")
            .remove([imagePath]);

          if (storageError) {
            console.log("Cloud image storage cleanup error:", storageError.message);
          }
        }
      }
    }

    await removePhoto(id);

    if (selectedFolder) {
      setPhotos(await getFolderPhotos(selectedFolder.id));
    }

    alert("Photo deleted successfully!");
  }

  
// TOGGLE FAVOURITE (LOCAL + CLOUD)
async function toggleFavourite(photo) {
  const updatedPhoto = {
    ...photo,
    favourite: !photo.favourite
  };

  try {
    await savePhoto(updatedPhoto);

    if (user) {
      const { error } = await supabase
        .from("jewellery_photos")
        .update({
          favourite: updatedPhoto.favourite
        })
        .eq("local_id", String(photo.id))
        .eq("owner_id", user.id);

      if (error) throw error;
    }

    if (showFavourites) {
      const allPhotos = await getAllPhotos();
      setPhotos(allPhotos.filter(item => item.favourite));
    } else if (selectedFolder) {
      setPhotos(await getFolderPhotos(selectedFolder.id));
    }

  } catch (error) {
    console.log("Favourite sync error:", error.message);
    alert("Favourite cloud sync failed: " + error.message);
  }
}


  // OPEN FAVOURITES
  async function openFavourites() {
    if (isCustomer) return;

    const allPhotos = await getAllPhotos();
    setPhotos(allPhotos.filter(photo => photo.favourite === true));
    setSelectedFolder(null);
    setShowFavourites(true);
  }

  // RENAME PHOTO
  async function renamePhoto(photoId) {
    const photo = photos.find(item => item.id === photoId);
    if (!photo) return;

    const newName = prompt("Enter new photo name:", photo.name);
    if (!newName || !newName.trim()) return;

    const updatedName = newName.trim();

    await savePhoto({ ...photo, name: updatedName });

    if (user) {
      const { error } = await supabase
        .from("jewellery_photos")
        .update({ name: updatedName })
        .eq("local_id", String(photo.id))
        .eq("owner_id", user.id);

      if (error) {
        alert("Cloud photo rename failed: " + error.message);
        console.log(error);
        return;
      }

      alert("Photo renamed successfully in cloud!");
    }

    if (selectedFolder) {
      setPhotos(await getFolderPhotos(selectedFolder.id));
    }
  }

  // EDIT PHOTO DETAILS
  async function editPhotoDetails(photoId) {
    const photo = photos.find(item => item.id === photoId);
    if (!photo) return;

    const price = prompt("Enter jewellery price:", photo.price || "");
    if (price === null) return;

    const weight = prompt("Enter weight in grams:", photo.weight || "");
    if (weight === null) return;

    const purity = prompt(
      "Enter purity (22K, 18K, 24K):",
      photo.purity || ""
    );
    if (purity === null) return;

    const description = prompt(
      "Enter description:",
      photo.description || ""
    );
    if (description === null) return;

    const updatedDetails = {
      ...photo,
      price,
      weight,
      purity,
      description
    };

    await savePhoto(updatedDetails);

    if (user) {
      const { error } = await supabase
        .from("jewellery_photos")
        .update({
          price,
          weight,
          purity,
          description
        })
        .eq("local_id", String(photo.id))
        .eq("owner_id", user.id);

      if (error) {
        alert("Cloud details update failed: " + error.message);
        console.log(error);
        return;
      }
    }

    if (showFavourites) {
      const allPhotos = await getAllPhotos();
      setPhotos(allPhotos.filter(item => item.favourite));
    } else if (selectedFolder) {
      setPhotos(await getFolderPhotos(selectedFolder.id));
    }

    alert("Jewellery details saved successfully!");
  }

  // REPLACE IMAGE (LOCAL + CLOUD)
  async function replacePhoto(event, photoId) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image");
      event.target.value = "";
      return;
    }

    try {
      const oldPhoto = photos.find(item => item.id === photoId);
      if (!oldPhoto) return;

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      if (user) {
        const { data: cloudPhoto, error: findError } = await supabase
          .from("jewellery_photos")
          .select("id, image_url")
          .eq("local_id", String(photoId))
          .eq("owner_id", user.id)
          .maybeSingle();

        if (findError) throw findError;

        if (!cloudPhoto) {
          alert("Cloud photo record not found! Please sync existing photos first.");
          return;
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const imagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("jewellery-photos")
          .upload(imagePath, file);

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("jewellery-photos")
          .getPublicUrl(imagePath);

        const { error: updateError } = await supabase
          .from("jewellery_photos")
          .update({
            name: file.name,
            image_url: publicData.publicUrl
          })
          .eq("id", cloudPhoto.id)
          .eq("owner_id", user.id);

        if (updateError) {
          await supabase.storage
            .from("jewellery-photos")
            .remove([imagePath]);
          throw updateError;
        }

        const marker = "/storage/v1/object/public/jewellery-photos/";
        const oldIndex = cloudPhoto.image_url?.indexOf(marker);

        if (oldIndex >= 0) {
          const oldPath = decodeURIComponent(
            cloudPhoto.image_url.slice(oldIndex + marker.length)
          );

          const { error: removeError } = await supabase.storage
            .from("jewellery-photos")
            .remove([oldPath]);

          if (removeError) {
            console.log("Old image cleanup error:", removeError.message);
          }
        }
      }

      await savePhoto({
        ...oldPhoto,
        name: file.name,
        data: dataUrl
      });

      if (selectedFolder) {
        setPhotos(await getFolderPhotos(selectedFolder.id));
      }

      alert("Photo replaced successfully!");
    } catch (error) {
      console.log(error);
      alert("Unable to replace photo: " + error.message);
    } finally {
      event.target.value = "";
    }
  }

  const filteredFolders = (isCustomer ? cloudFolders : folders).filter(
    folder => folder.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app">
      {/* ROLE SELECTION */}
      {!user && !isCustomer && (
        <div className="role-screen">
          <h1>JEWELLERY COLLECTION</h1>
          <p>Welcome to Our Jewellery Store</p>

          <button onClick={openCustomerView}>Customer View</button>
          <button onClick={() => setShowLogin(true)}>Owner Login</button>

          {showLogin && (
            <div>
              <h2>Owner Login</h2>

              <input
                type="email"
                placeholder="Owner Email"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />

              <input
  type="text"
  placeholder="Enter GST Number"
  value={gstNumber}
  onChange={(e) => setGstNumber(e.target.value)}
/>

              

              <button onClick={ownerLogin}>Login</button>
              <button onClick={() => setShowLogin(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* HEADER */}
      {(user || isCustomer) && (
        <header className="header">
          <div className="logo">💎 Jewellery Collection</div>
          <span className="shop">MY SHOP</span>

          <div className="metal-rates">
            <div className="rate-box">
              <span>💛 GOLD RATE</span>
              <strong>₹{goldRate || "Enter Rate"}</strong>
              <small>Per 10 Gram</small>

              {user && (
                <button
                  onClick={() => {
                    const rate = prompt(
                      "Enter Gold Rate per 10 Gram:",
                      goldRate
                    );

                    if (rate !== null && rate.trim() !== "") {
                      setGoldRate(rate);
                      saveRatesToCloud(rate, silverRate);
                    }
                  }}
                >
                  Edit Rate
                </button>
              )}
            </div>

            <div className="rate-box">
              <span>🤍 SILVER RATE</span>
              <strong>₹{silverRate || "Enter Rate"}</strong>
              <small>Per 10 Gram</small>

              {user && (
                <button
                  onClick={() => {
                    const rate = prompt(
                      "Enter Silver Rate per 10 Gram:",
                      silverRate
                    );

                    if (rate !== null && rate.trim() !== "") {
                      setSilverRate(rate);
                      saveRatesToCloud(goldRate, rate);
                    }
                  }}
                >
                  Edit Rate
                </button>
              )}
            </div>
          </div>

          {user && <button onClick={ownerLogout}>Logout</button>}

          {isCustomer && (
            <button
              onClick={() => {
                setIsCustomer(false);
                setSelectedFolder(null);
                setShowFavourites(false);
                setPhotos([]);
                setCloudPhotos([]);
              }}
            >
              Exit Customer View
            </button>
          )}
        </header>
      )}

      {/* MAIN CONTENT */}
      {(user || isCustomer) && (
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
                  onChange={event => setSearch(event.target.value)}
                />

                {user && (
                  <div className="add-box">
                    <input
                      placeholder="Enter new category name"
                      value={newFolder}
                      onChange={event => setNewFolder(event.target.value)}
                      onKeyDown={event =>
                        event.key === "Enter" && addFolder()
                      }
                    />
                    <button onClick={addFolder}>+ Create Folder</button>
                  </div>
                )}
              </div>

              <div className="section-title">
                <h2>My Categories</h2>
                <span>{filteredFolders.length} Folders</span>
              </div>

              {!isCustomer && (
                <button onClick={openFavourites}>
                  ❤️ My Favourites
                </button>
              )}

              {/* BACKUP AND RESTORE */}
              {user && (
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

                  <button onClick={syncFoldersToCloud}>
                    ☁️ Sync Folders to Cloud
                  </button>

                  <button onClick={syncPhotosToCloud}>
                    ☁️ Sync Photos to Cloud
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
              )}

              {/* FOLDERS */}
              <div className="folder-grid">
                {filteredFolders.map(folder => (
                  <div className="folder-card" key={folder.id}>
                    <div className="folder-icon">📁</div>
                    <h3>{folder.name}</h3>

                    <p>
                      {isCustomer
                        ? cloudPhotos.filter(
                            photo => photo.folderId === folder.id
                          ).length
                        : folderPhotoCounts[folder.id] || 0}{" "}
                      Photos
                    </p>

                    {user && (
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
                    )}

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
              <button
                onClick={() => {
                  setShowFavourites(false);
                  setPhotos([]);
                }}
              >
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
                onClick={() => {
                  setSelectedFolder(null);
                  setPhotos([]);
                }}
              >
                ← Back to Categories
              </button>

              <div className="welcome">
                <h1>📁 {selectedFolder.name}</h1>
                <p>Your jewellery photos collection</p>
              </div>

              {user && (
                <label className="upload-button" htmlFor="photoUpload">
                  + Add Jewellery Photos
                </label>
              )}

              {user && (
                <input
                  id="photoUpload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={addPhotos}
                  style={{ display: "none" }}
                />
              )}

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

                      {!isCustomer && (
                        <button
                          className="favorite-button"
                          onClick={() => toggleFavourite(photo)}
                        >
                          {photo.favourite
                            ? "❤️ Remove Favourite"
                            : "♡ Add to Favourites"}
                        </button>
                      )}

                      {/* OWNER PHOTO ACTIONS */}
                      {user && (
                        <>
                          <div className="photo-actions">
                            <button onClick={() => renamePhoto(photo.id)}>
                              Edit Photo Name
                            </button>

                            <button
                              onClick={() => editPhotoDetails(photo.id)}
                            >
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
                            onChange={event =>
                              replacePhoto(event, photo.id)
                            }
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* PHOTO PREVIEW */}
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
            ×
          </button>

          <img
            src={previewPhoto.data}
            alt={previewPhoto.name}
            onClick={event => event.stopPropagation()}
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
