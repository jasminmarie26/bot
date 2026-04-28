function registerRaeumeErstellenBearbeitenRoutes(app, deps) {
  const {
    requireAuth,
    getCharacterById,
    rememberPreferredCharacter,
    getSavedNonFestplayRoomsForUser,
    setFlash,
    getSafeReturnTarget,
    reorderOwnedRooms,
    canAccessCharacter,
    normalizeRoomName,
    normalizeRoomDescription,
    ensurePublicRoomForServer,
    ensureOwnedRoomForCharacter,
    emitRoomListRefresh,
    db,
    normalizeServer,
    normalizeRoomTeaser,
    getSocketsInChannel,
    clearPendingRoomDeletion,
    finalizeRoomLog,
    deleteRoomData,
    io,
    toRoomNameKey,
    findOwnedRoomByNameKey,
    isCuratedPublicRoom,
    saveCuratedRoomOverride,
    getRoomWithCharacter,
    maybeStartAutomaticRoomLog,
    getActiveRoomLog,
    emitSystemChatMessage,
    emitRoomStateUpdate,
    getChatCharacterUrlNumberById,
    rememberChatLocationForCharacter
  } = deps;

  app.get("/characters/:id/rooms/new", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).render("errors/404", { title: "Nicht gefunden" });
    }

    const character = getCharacterById(id);
    if (!character) {
      return res.status(404).render("errors/404", { title: "Nicht gefunden" });
    }

    if (character.user_id !== req.session.user.id) {
      return res.status(403).render("errors/error", {
        title: "Kein Zugriff",
        message: "Nur der Besitzer darf mit diesem Charakter einen eigenen Raum erstellen."
      });
    }

    rememberPreferredCharacter(req, character);
    const ownedRooms = getSavedNonFestplayRoomsForUser(
      req.session.user.id,
      character.id,
      character.server_id
    );
    const selectedRoomId = Number(req.query.selected_room);
    const selectedRoom =
      ownedRooms.find((room) => Number(room.id) === selectedRoomId) || null;

    return res.render("rooms/raeume-erstellen-bearbeiten", {
      title: `Raum erstellen: ${character.name}`,
      character,
      chatCharacterUrlNumber:
        typeof getChatCharacterUrlNumberById === "function"
          ? getChatCharacterUrlNumberById(character.id) || character.id
          : character.id,
      ownedRooms,
      selectedRoom
    });
  });

  app.post("/characters/:id/rooms/reorder", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const fallbackReturnTarget = `/characters/${id}/rooms/new#room-create`;
    const isFetchRequest =
      String(req.get("x-requested-with") || "").trim().toLowerCase() === "fetch";

    if (!Number.isInteger(id) || id < 1) {
      if (isFetchRequest) {
        return res.status(404).json({ error: "Nicht gefunden" });
      }
      return res.status(404).render("errors/404", { title: "Nicht gefunden" });
    }

    const character = getCharacterById(id);
    if (!character) {
      if (isFetchRequest) {
        return res.status(404).json({ error: "Nicht gefunden" });
      }
      return res.status(404).render("errors/404", { title: "Nicht gefunden" });
    }

    if (character.user_id !== req.session.user.id) {
      if (isFetchRequest) {
        return res.status(403).json({ error: "Kein Zugriff" });
      }
      return res.status(403).render("errors/error", {
        title: "Kein Zugriff",
        message: "Nur der Besitzer darf eigene Raeume sortieren."
      });
    }

    let orderedRoomIds = [];
    try {
      const rawRoomIds = req.body.room_ids;
      if (Array.isArray(rawRoomIds)) {
        orderedRoomIds = rawRoomIds;
      } else if (typeof rawRoomIds === "string") {
        const trimmedValue = rawRoomIds.trim();
        orderedRoomIds = trimmedValue.startsWith("[")
          ? JSON.parse(trimmedValue)
          : trimmedValue.split(",").map((entry) => entry.trim()).filter(Boolean);
      }
    } catch (error) {
      console.error("owned room reorder payload parse failed", {
        characterId: id,
        userId: req.session.user.id,
        error
      });
    }

    try {
      const updated = reorderOwnedRooms(
        req.session.user.id,
        character.id,
        character.server_id,
        orderedRoomIds
      );
      if (!updated) {
        if (isFetchRequest) {
          return res.status(400).json({ error: "Raumreihenfolge konnte nicht gespeichert werden." });
        }
        setFlash(req, "error", "Die Raumreihenfolge konnte nicht gespeichert werden.");
        return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
      }
    } catch (error) {
      console.error("owned room reorder failed", {
        characterId: id,
        userId: req.session.user.id,
        roomIds: orderedRoomIds,
        error
      });
      if (isFetchRequest) {
        return res.status(500).json({ error: "Raumreihenfolge konnte nicht gespeichert werden." });
      }
      setFlash(req, "error", "Beim Sortieren der Raeume ist ein Fehler aufgetreten.");
      return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
    }

    if (isFetchRequest) {
      return res.status(204).end();
    }

    return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
  });

  app.post("/characters/:id/enter-room", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const character = getCharacterById(id);

    if (!character) {
      return res.status(404).render("errors/404", { title: "Nicht gefunden" });
    }

    if (
      !canAccessCharacter(
        req.session.user.id,
        character.user_id,
        character.is_public,
        req.session.user.is_admin
      )
    ) {
      return res.status(403).render("errors/error", {
        title: "Kein Zugriff",
        message: "Dieser Charakter ist privat."
      });
    }

    if (character.user_id !== req.session.user.id) {
      return res.status(403).render("errors/error", {
        title: "Kein Zugriff",
        message: "Nur der Besitzer darf mit diesem Charakter einen eigenen Raum anlegen."
      });
    }

    const roomName = normalizeRoomName(req.body.room_name);
    const roomDescription = normalizeRoomDescription(req.body.room_description || req.body.room_teaser);
    const returnTarget = String(req.body.return_to || "").trim().toLowerCase();
    if (roomName.length < 2) {
      setFlash(req, "error", "Bitte einen gültigen Raumnamen eingeben.");
      return res.redirect(returnTarget === "roomlist" ? `/characters/${id}#roomlist` : `/characters/${id}/rooms/new`);
    }

    if (character.user_id === req.session.user.id) {
      rememberPreferredCharacter(req, character);
    }

    const targetRoom = returnTarget === "roomlist"
      ? ensurePublicRoomForServer(req.session.user.id, character, roomName, roomDescription)
      : ensureOwnedRoomForCharacter(req.session.user.id, character, roomName, roomDescription);
    if (!targetRoom) {
      setFlash(req, "error", "Raum konnte nicht angelegt werden.");
      return res.redirect(returnTarget === "roomlist" ? `/characters/${id}#roomlist` : `/characters/${id}/rooms/new`);
    }

    if (targetRoom.created) {
      emitRoomListRefresh(character.server_id);
    }

    if (returnTarget === "roomlist") {
      if (typeof rememberChatLocationForCharacter === "function") {
        rememberChatLocationForCharacter(req, character.id, {
          roomId: targetRoom.id,
          serverId: targetRoom.server_id || character.server_id
        });
      }

      const chatCharacterUrlNumber =
        typeof getChatCharacterUrlNumberById === "function"
          ? getChatCharacterUrlNumberById(character.id) || character.id
          : character.id;
      return res.redirect(`/chat/room?c=${chatCharacterUrlNumber}`);
    }

    return res.redirect(`/characters/${id}/rooms/new`);
  });

  app.post("/characters/:id/rooms/:roomId/update", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const roomId = Number(req.params.roomId);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(roomId) || roomId < 1) {
      return res.status(404).render("errors/404", { title: "Nicht gefunden" });
    }

    const character = getCharacterById(id);
    if (!character) {
      return res.status(404).render("errors/404", { title: "Nicht gefunden" });
    }

    if (character.user_id !== req.session.user.id) {
      return res.status(403).render("errors/error", {
        title: "Kein Zugriff",
        message: "Nur der Besitzer darf eigene Räume bearbeiten."
      });
    }

    const room = db
      .prepare(
        `SELECT id, server_id, created_by_user_id, name, description, teaser, image_url, email_log_enabled, is_locked, is_public_room, is_saved_room
         , character_id
         FROM chat_rooms
         WHERE id = ?
           AND COALESCE(festplay_id, 0) = 0
           AND COALESCE(is_festplay_chat, 0) = 0
           AND COALESCE(is_manual_festplay_room, 0) = 0
           AND COALESCE(is_festplay_side_chat, 0) = 0`
      )
      .get(roomId);
    if (
      !room ||
      Number(room.created_by_user_id) !== Number(req.session.user.id) ||
      Number(room.character_id) !== Number(character.id) ||
      Number(room.is_saved_room) !== 1 ||
      normalizeServer(room.server_id) !== normalizeServer(character.server_id)
    ) {
      setFlash(req, "error", "Dieser Raum konnte nicht gefunden werden.");
      return res.redirect(`/characters/${id}/rooms/new`);
    }

    const roomName = normalizeRoomName(req.body.room_name);
    const roomDescription = normalizeRoomDescription(req.body.room_description);
    const roomTeaser = normalizeRoomTeaser(req.body.room_teaser);
    const roomImageUrl = String(room.image_url || "");
    const emailLogEnabled = req.body.email_log_enabled ? 1 : 0;
    const isLocked = req.body.is_locked ? 1 : 0;

    if (req.body.delete_room) {
      if (getSocketsInChannel(roomId, room.server_id).length > 0) {
        setFlash(req, "error", "Der Raum kann erst gelöscht werden, wenn niemand mehr darin ist.");
        return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
      }

      clearPendingRoomDeletion(roomId);
      await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
      deleteRoomData(roomId);
      io.emit("chat:room-removed", { room_id: roomId });
      emitRoomListRefresh(room.server_id);
      setFlash(req, "success", "Raum gelöscht.");
      return res.redirect(`/characters/${id}/rooms/new`);
    }

    if (roomName.length < 2) {
      setFlash(req, "error", "Bitte einen gültigen Raumnamen eingeben.");
      return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
    }

    const nextRoomNameKey = toRoomNameKey(roomName);
    const currentRoomNameKey = toRoomNameKey(room.name);
    const conflictingRoom = nextRoomNameKey === currentRoomNameKey
        ? null
      : findOwnedRoomByNameKey(
          req.session.user.id,
          character.id,
          character.server_id,
          nextRoomNameKey,
          roomDescription
        );
    if (conflictingRoom && Number(conflictingRoom.id) !== roomId) {
      setFlash(req, "error", "Du hast bereits einen Raum mit diesem Namen.");
      return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
    }

    db.prepare(
      `UPDATE chat_rooms
       SET name = ?,
           name_key = ?,
           description = ?,
           teaser = ?,
           image_url = ?,
           email_log_enabled = ?,
           is_locked = ?
       WHERE id = ?`
    ).run(
      roomName,
      nextRoomNameKey,
      roomDescription,
      roomTeaser,
      roomImageUrl,
      emailLogEnabled,
      isLocked,
      roomId
    );

    if (isCuratedPublicRoom(room, room.server_id)) {
      saveCuratedRoomOverride(
        room.server_id,
        room.name_key || toRoomNameKey(roomName),
        roomDescription,
        roomTeaser
      );
    }

    const refreshedRoom = getRoomWithCharacter(roomId);
    if (emailLogEnabled === 1 && Number(room.email_log_enabled) !== 1) {
      maybeStartAutomaticRoomLog(roomId, room.server_id, refreshedRoom);
    } else if (
      emailLogEnabled !== 1 &&
      Number(room.email_log_enabled) === 1 &&
      getActiveRoomLog(roomId, room.server_id)
    ) {
      emitSystemChatMessage(roomId, room.server_id, "Log wurde deaktiviert.");
      await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
    }

    emitRoomStateUpdate(roomId, room.server_id, refreshedRoom);
    emitRoomListRefresh(room.server_id);
    return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
  });

  app.post("/characters/:id/rooms/:roomId/delete", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const roomId = Number(req.params.roomId);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(roomId) || roomId < 1) {
      return res.status(404).render("errors/404", { title: "Nicht gefunden" });
    }

    const character = getCharacterById(id);
    if (!character) {
      return res.status(404).render("errors/404", { title: "Nicht gefunden" });
    }

    if (character.user_id !== req.session.user.id) {
      return res.status(403).render("errors/error", {
        title: "Kein Zugriff",
        message: "Nur der Besitzer darf eigene Räume löschen."
      });
    }

    const room = db
      .prepare(
        `SELECT id, name, server_id, created_by_user_id, character_id, is_public_room, is_saved_room
         FROM chat_rooms
         WHERE id = ?
           AND COALESCE(festplay_id, 0) = 0`
      )
      .get(roomId);
    if (
      !room ||
      Number(room.created_by_user_id) !== Number(req.session.user.id) ||
      Number(room.character_id) !== Number(character.id) ||
      Number(room.is_saved_room) !== 1 ||
      normalizeServer(room.server_id) !== normalizeServer(character.server_id)
    ) {
      setFlash(req, "error", "Dieser Raum konnte nicht gefunden werden.");
      return res.redirect(`/characters/${id}/rooms/new`);
    }

    if (getSocketsInChannel(roomId, room.server_id).length > 0) {
      setFlash(req, "error", "Der Raum kann erst gelöscht werden, wenn niemand mehr darin ist.");
      return res.redirect(`/characters/${id}/rooms/new`);
    }

    clearPendingRoomDeletion(roomId);
    await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
    deleteRoomData(roomId);
    io.emit("chat:room-removed", { room_id: roomId });
    emitRoomListRefresh(room.server_id);

    return res.redirect(`/characters/${id}/rooms/new`);
  });
}

module.exports = {
  registerRaeumeErstellenBearbeitenRoutes
};
