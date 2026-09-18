--[[
	ForeverIntegration.server.lua

	Forever Roleplay <-> Discord integration.
	Place this script in ServerScriptService.

	SECURITY NOTES:
	- This is a Script (server-side), never a LocalScript.
	- The API key below is only ever read on the server and is never sent to clients.
	- No RemoteEvents are exposed that let clients trigger admin actions directly.
	- All admin actions arrive exclusively through the polling loop below, which
	  only accepts commands the API server itself decided to queue.
--]]

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

----------------------------------------------------------------
-- CONFIG — edit these values for your setup
----------------------------------------------------------------

local Config = {
	-- Your Forever RP API base URL, e.g. "https://api.foreverrp.example.com"
	API_URL = "https://YOUR-API-DOMAIN-HERE",

	-- Must match API_KEY in your Node.js .env file exactly.
	API_KEY = "YOUR-API-KEY-HERE",

	PollInterval = 3,      -- seconds between command polls
	HeartbeatInterval = 5, -- seconds between server status heartbeats

	-- ============================================================
	-- JUMPSCARE
	-- Vul je eigen Roblox asset IDs in (upload via Studio -> Toolbox
	-- of via create.roblox.com). Zonder geldige IDs toont dit niks.
	-- ============================================================
	JumpscareImageId = "rbxassetid://0",  -- vul je eigen jumpscare-afbeelding asset ID in
	JumpscareSoundId = "rbxassetid://0",  -- vul je eigen jumpscare-geluid asset ID in
	JumpscareDurationSeconds = 3,

	-- ============================================================
	-- OBJECT PATH CONFIG
	-- These names depend on how your Forever RP economy/data is
	-- structured under the Player instance. Adjust if your game
	-- uses different names.
	-- ============================================================

	-- Economy folder directly under Player, containing NumberValue/IntValue
	-- instances named "Contant" and "Bank" (as specified in the prompt).
	EconomyFolderName = "Economy",
	EconomyContantValueName = "Contant",
	EconomyBankValueName = "Bank",

	-- Where rank is stored — an IntValue/NumberValue under the Player.
	RankValueName = "Rank",

	-- ============================================================
	-- JOBS
	-- Matches your existing setjobconfig system: a "Jobs" Folder under
	-- the Player containing one IntValue per job (created elsewhere in
	-- your game on PlayerAdded from ServerScriptService.setjobconfig).
	-- Setting a job resets every other job IntValue to 0 first, then
	-- sets the target job's IntValue to the given level — matching your
	-- existing in-game admin command behaviour exactly.
	-- ============================================================
	JobsFolderName = "Jobs",

	-- Whitelist of valid job keys. Keep this EXACTLY in sync with:
	--   1. ServerScriptService.setjobconfig (the real source of truth in-game)
	--   2. shared/jobs.js (used by the bot + API for validation)
	AllowedJobs = {
		-- Overheid — uitdienst
		"offpolice", "offkmar", "offambulance", "offmechanic", "offadvocaat", "offbrandweer",
		-- Overheid — indienst
		"kmar", "police", "dsi", "recherche", "mechanic", "ambulance", "dji", "kct",
		"brandweer", "taxi", "security",
		"hrb", "bot",
		-- Werkloos
		"unemployed",
		-- Non-whitelisted jobs
		"postnl", "technician", "Vakkenvuller", "duiker", "poolcleaner", "vuilnisman", "thuisbezorgd",
		-- Whitelisted burger jobs
		"luxury", "advocaat", "vliegschool",
		-- Gang jobs
		"gang_bratva", "gang_gaviao", "gang_brigazi", "gang_grmc", "gang_gsf", "gang_kaibiles",
		"gang_kozlov", "gang_lostmc", "gang_medellin", "gang_menendez", "gang_mercy", "gang_laicona",
		"gang_yakuza", "gang_netas", "gang_reznikov", "gang_saints", "gang_scc", "gang_soulz",
		"gang_traids", "gang_santos", "gang_ww", "gang_yt", "gang_zone6", "gang_bloods", "gang_blockp",
		"gang_bandoleros", "gang_alba", "gang_akatsuki", "gang_14k", "gang_handz", "gang_montana",
		"gang_cali", "gang_sinaloa", "gang_santosboss", "lafamboss", "gang_ms_13", "gang_kitty",
		"gang_sc", "gang_laonda", "gang_crips", "gang_muertos", "gang_tijuana", "gang_satudarah",
		"kerstpack", "mocro", "wapendealer", "Owner",
		-- Onderwereld
		"gang_narcos", "gang_lafamilia", "gang_young",
		"union", "Hitman", "hellokitty", "Onderwereld",
	},

	-- ============================================================
	-- XP
	-- ============================================================
	XpValueName = "XP", -- NumberValue/IntValue direct onder de Player

	-- ============================================================
	-- WHITELIST
	-- Zet op true om alleen spelers op de whitelist (via /whitelist add
	-- in Discord) toe te laten. Staat standaard UIT zodat dit niets
	-- breekt totdat je het bewust inschakelt.
	-- ============================================================
	WhitelistEnabled = false,

	-- ============================================================
	-- STAFF DIENST
	-- Naam van de BoolValue onder de Player die aan/uit gaat wanneer een
	-- staff-lid het staffvest aan/uit doet (zoals in je bestaande
	-- StaffPanel/hesje-script). Wordt hier alleen UITGELEZEN, niet
	-- aangemaakt of gewijzigd — dat blijft je eigen script doen.
	-- ============================================================
	StaffDutyValueName = "Staffdienst",

	-- ============================================================
	-- STATS REPORTING (voor /playerstats en /leaderboard)
	-- ============================================================
	StatsReportInterval = 60, -- seconden tussen elke stats-snapshot per online speler
	XpForStatsValueName = "XP", -- zelfde als XpValueName, apart configureerbaar mocht dat ooit verschillen
	PlaytimeValueName = "Playtime", -- optioneel: IntValue (in minuten) onder Player, indien aanwezig
}

----------------------------------------------------------------
-- INTERNAL STATE
----------------------------------------------------------------

local processedCommandIds = {} -- in-memory dedupe cache for this server session

----------------------------------------------------------------
-- HTTP HELPERS
----------------------------------------------------------------

local function apiRequest(method, path, body)
	local url = Config.API_URL .. path
	local headers = {
		["Content-Type"] = "application/json",
		["X-API-Key"] = Config.API_KEY,
	}

	local ok, response = pcall(function()
		if method == "GET" then
			return HttpService:RequestAsync({
				Url = url,
				Method = "GET",
				Headers = headers,
			})
		else
			return HttpService:RequestAsync({
				Url = url,
				Method = method,
				Headers = headers,
				Body = body and HttpService:JSONEncode(body) or nil,
			})
		end
	end)

	if not ok then
		warn("[ForeverIntegration] HTTP request failed: " .. tostring(response))
		return nil
	end

	if not response.Success then
		warn(("[ForeverIntegration] API responded %d for %s %s: %s"):format(
			response.StatusCode, method, path, response.Body or ""
		))
		return nil
	end

	local decodeOk, decoded = pcall(function()
		return HttpService:JSONDecode(response.Body)
	end)

	if not decodeOk then
		warn("[ForeverIntegration] Failed to decode JSON response from " .. path)
		return nil
	end

	return decoded
end

----------------------------------------------------------------
-- ECONOMY HELPERS
----------------------------------------------------------------

local function getEconomyValue(player, valueName)
	local economy = player:FindFirstChild(Config.EconomyFolderName)
	if not economy then
		warn(("[ForeverIntegration] Player %s heeft geen '%s' folder — pas Config.EconomyFolderName aan."):format(
			player.Name, Config.EconomyFolderName
		))
		return nil
	end

	local value = economy:FindFirstChild(valueName)
	if not value then
		warn(("[ForeverIntegration] '%s' object niet gevonden onder %s — pas Config aan."):format(
			valueName, Config.EconomyFolderName
		))
		return nil
	end

	if type(value.Value) ~= "number" then
		warn(("[ForeverIntegration] '%s' is geen numerieke waarde."):format(valueName))
		return nil
	end

	return value
end

local function getAccountValueName(account)
	if account == "Contant" then
		return Config.EconomyContantValueName
	elseif account == "Bank" then
		return Config.EconomyBankValueName
	end
	return nil
end

----------------------------------------------------------------
-- COMMAND HANDLERS
----------------------------------------------------------------

local CommandHandlers = {}

CommandHandlers["give_money"] = function(player, payload)
	local valueName = getAccountValueName(payload.account)
	if not valueName then
		return false, "Onbekende rekening: " .. tostring(payload.account)
	end

	local value = getEconomyValue(player, valueName)
	if not value then
		return false, "Economy object niet gevonden"
	end

	local amount = tonumber(payload.amount)
	if not amount or amount < 0 then
		return false, "Ongeldig bedrag"
	end

	value.Value = value.Value + amount
	return true, ("+%d toegevoegd aan %s"):format(amount, payload.account)
end

CommandHandlers["remove_money"] = function(player, payload)
	local valueName = getAccountValueName(payload.account)
	if not valueName then
		return false, "Onbekende rekening: " .. tostring(payload.account)
	end

	local value = getEconomyValue(player, valueName)
	if not value then
		return false, "Economy object niet gevonden"
	end

	local amount = tonumber(payload.amount)
	if not amount or amount < 0 then
		return false, "Ongeldig bedrag"
	end

	value.Value = math.max(0, value.Value - amount)
	return true, ("-%d verwijderd van %s"):format(amount, payload.account)
end

CommandHandlers["set_money"] = function(player, payload)
	local valueName = getAccountValueName(payload.account)
	if not valueName then
		return false, "Onbekende rekening: " .. tostring(payload.account)
	end

	local value = getEconomyValue(player, valueName)
	if not value then
		return false, "Economy object niet gevonden"
	end

	local amount = tonumber(payload.amount)
	if not amount or amount < 0 then
		return false, "Ongeldig bedrag"
	end

	value.Value = amount
	return true, ("%s ingesteld op %d"):format(payload.account, amount)
end

local function isJobAllowed(job)
	for _, allowed in ipairs(Config.AllowedJobs) do
		if allowed == job then
			return true
		end
	end
	return false
end

-- Sets a player's job by resetting every IntValue inside their Jobs folder
-- to 0, then setting the target job's IntValue to `level`. This matches
-- your existing in-game admin command exactly (1 active job at a time,
-- with a numeric level/rank within that job).
CommandHandlers["set_job"] = function(player, payload)
	if not isJobAllowed(payload.job) then
		return false, "Job niet toegestaan: " .. tostring(payload.job)
	end

	local level = tonumber(payload.level)
	if not level or level < 1 then
		return false, "Ongeldig niveau"
	end

	local jobsFolder = player:FindFirstChild(Config.JobsFolderName)
	if not jobsFolder then
		warn(("[ForeverIntegration] '%s' folder niet gevonden onder Player — pas Config.JobsFolderName aan."):format(
			Config.JobsFolderName
		))
		return false, "Jobs folder niet gevonden"
	end

	local targetValue = jobsFolder:FindFirstChild(payload.job)
	if not targetValue then
		warn(("[ForeverIntegration] Job '%s' niet gevonden in Jobs folder van %s."):format(
			payload.job, player.Name
		))
		return false, "Job object niet gevonden in Jobs folder"
	end

	-- Reset every other job to 0 first (1 active job at a time).
	for _, child in ipairs(jobsFolder:GetChildren()) do
		if child:IsA("IntValue") then
			child.Value = 0
		end
	end

	targetValue.Value = level

	return true, ("Job ingesteld op %s (niveau %d)"):format(payload.job, level)
end

CommandHandlers["set_rank"] = function(player, payload)
	local rankValue = player:FindFirstChild(Config.RankValueName)
	if not rankValue then
		warn(("[ForeverIntegration] '%s' object niet gevonden onder Player — pas Config.RankValueName aan."):format(
			Config.RankValueName
		))
		return false, "Rank object niet gevonden"
	end

	local rank = tonumber(payload.rank)
	if not rank or rank < 0 then
		return false, "Ongeldige rank"
	end

	rankValue.Value = rank
	return true, "Rank ingesteld op " .. tostring(rank)
end

----------------------------------------------------------------
-- XP
----------------------------------------------------------------

CommandHandlers["set_xp"] = function(player, payload)
	local xpValue = player:FindFirstChild(Config.XpValueName)
	if not xpValue then
		warn(("[ForeverIntegration] '%s' object niet gevonden onder Player — pas Config.XpValueName aan."):format(
			Config.XpValueName
		))
		return false, "XP object niet gevonden"
	end

	local amount = tonumber(payload.amount)
	if not amount or amount < 0 then
		return false, "Ongeldige XP-waarde"
	end

	xpValue.Value = amount
	return true, "XP ingesteld op " .. tostring(amount)
end

----------------------------------------------------------------
-- VOERTUIGEN
-- Verwacht dezelfde _G-hook stijl als de Ox_Inventory integratie
-- (_G.OxGiveItem). Koppel _G.OxGiveVehicle / _G.OxRemoveVehicle aan je
-- eigen voertuigsysteem.
----------------------------------------------------------------

CommandHandlers["give_vehicle"] = function(player, payload)
	if not _G.OxGiveVehicle then
		return false, "_G.OxGiveVehicle niet beschikbaar (voertuigsysteem-hook nog niet gekoppeld)"
	end

	local ok, message = _G.OxGiveVehicle(player, payload.vehicle)
	if ok == false then
		return false, message or "Voertuigsysteem gaf false terug"
	end

	return true, ("Voertuig '%s' gegeven"):format(payload.vehicle)
end

CommandHandlers["remove_vehicle"] = function(player, payload)
	if not _G.OxRemoveVehicle then
		return false, "_G.OxRemoveVehicle niet beschikbaar (voertuigsysteem-hook nog niet gekoppeld)"
	end

	local ok, message = _G.OxRemoveVehicle(player, payload.vehicle)
	if ok == false then
		return false, message or "Voertuigsysteem gaf false terug"
	end

	return true, ("Voertuig '%s' verwijderd"):format(payload.vehicle)
end

----------------------------------------------------------------
-- JUMPSCARE
----------------------------------------------------------------

CommandHandlers["jumpscare"] = function(player, payload)
	local playerGui = player:FindFirstChild("PlayerGui")
	if not playerGui then
		return false, "PlayerGui niet gevonden"
	end

	local gui = Instance.new("ScreenGui")
	gui.Name = "ForeverJumpscare"
	gui.IgnoreGuiInset = true
	gui.DisplayOrder = 999999

	local image = Instance.new("ImageLabel")
	image.Size = UDim2.new(1, 0, 1, 0)
	image.BackgroundColor3 = Color3.new(0, 0, 0)
	image.BackgroundTransparency = 0
	image.Image = Config.JumpscareImageId
	image.ScaleType = Enum.ScaleType.Crop
	image.Parent = gui

	gui.Parent = playerGui

	local sound = Instance.new("Sound")
	sound.SoundId = Config.JumpscareSoundId
	sound.Volume = 1
	sound.Parent = image
	sound:Play()

	task.delay(Config.JumpscareDurationSeconds, function()
		if gui and gui.Parent then
			gui:Destroy()
		end
	end)

	return true, "Jumpscare weergegeven"
end

----------------------------------------------------------------
-- REVIVE
----------------------------------------------------------------

CommandHandlers["revive"] = function(player, payload)
	local character = player.Character
	if not (character and character:FindFirstChild("HumanoidRootPart")) then
		return false, "Kan positie van de speler niet bepalen"
	end

	local savedPosition = character.HumanoidRootPart.Position

	-- Compatible with the Ox_Inventory revive-inventory hook, if present.
	if _G.OxSetReviveInventory then
		_G.OxSetReviveInventory(player)
	end

	player:LoadCharacter()

	task.spawn(function()
		local newChar = nil
		local timeout = tick() + 5
		repeat
			task.wait(0.1)
			newChar = player.Character
		until (newChar and newChar ~= character and newChar:FindFirstChild("HumanoidRootPart") and newChar:FindFirstChildOfClass("Humanoid")) or tick() > timeout

		if not newChar or not newChar:FindFirstChild("HumanoidRootPart") then
			warn("[ForeverIntegration] Revive: karakter niet geladen voor " .. player.Name)
			return
		end

		task.wait(0.3)
		newChar.HumanoidRootPart.CFrame = CFrame.new(savedPosition + Vector3.new(0, 3, 0))

		local hum = newChar:FindFirstChildOfClass("Humanoid")
		if hum then
			hum:SetStateEnabled(Enum.HumanoidStateType.Dead, false)
			hum.Health = hum.MaxHealth
		end
	end)

	return true, "Revive verwerkt"
end

----------------------------------------------------------------
-- OX INVENTORY INTEGRATION (give_item, clear_inventory)
-- Uses the _G globals your Ox_Inventory script already exposes.
-- No changes needed to that script.
----------------------------------------------------------------

CommandHandlers["give_item"] = function(player, payload)
	if not _G.OxGiveItem then
		return false, "Ox_Inventory _G.OxGiveItem niet beschikbaar (script niet geladen?)"
	end

	local ok = _G.OxGiveItem(player, payload.item, payload.amount or 1)
	if not ok then
		return false, "Ox_Inventory gaf false terug (te zwaar / geen plek?)"
	end

	return true, ("%dx %s gegeven"):format(payload.amount or 1, payload.item)
end

CommandHandlers["clear_inventory"] = function(player, payload)
	if not _G.OxGetSession or not _G.OxRemoveItem then
		return false, "Ox_Inventory _G functies niet beschikbaar (script niet geladen?)"
	end

	local session = _G.OxGetSession(player)
	if not session then
		return false, "Geen actieve Ox inventory sessie voor deze speler"
	end

	-- Snapshot first — removing while iterating the live table is unsafe.
	local toRemove = {}
	for _, item in pairs(session.inventory) do
		if type(item) == "table" and item.Name then
			table.insert(toRemove, {Name = item.Name, Count = item.Count or 1})
		end
	end

	for _, entry in ipairs(toRemove) do
		_G.OxRemoveItem(player, entry.Name, entry.Count)
	end

	return true, "Inventory geleegd (" .. #toRemove .. " stack(s) verwijderd)"
end

----------------------------------------------------------------
-- FVR STORE INTEGRATION (give_coins, give_pack)
----------------------------------------------------------------

CommandHandlers["give_coins"] = function(player, payload)
	local economy = player:FindFirstChild("Economy")
	if not economy then
		return false, "Economy folder niet gevonden"
	end

	local coins = economy:FindFirstChild("FVRCOINS")
	if not coins then
		return false, "FVRCOINS object niet gevonden (speler heeft nog geen store-sessie geladen?)"
	end

	local amount = tonumber(payload.amount)
	if not amount or amount < 1 then
		return false, "Ongeldig aantal"
	end

	coins.Value = coins.Value + amount
	return true, ("%d FVR Coins toegevoegd"):format(amount)
end

-- Geeft een volledig pack (tag + wapens + auto's + geld) via de
-- _G.FVRGivePack functie die in roblox/FVRStore.server.lua staat.
-- Zorg dat je FVRStore.server.lua hebt bijgewerkt met die functie,
-- anders valt dit terug op alleen de owned-vlag.
CommandHandlers["give_pack"] = function(player, payload)
	if _G.FVRGivePack then
		local ok, message = _G.FVRGivePack(player, payload.packName)
		return ok, message
	end

	-- Fallback: FVRStore.server.lua is nog niet bijgewerkt met
	-- _G.FVRGivePack — zet in elk geval de owned-vlag zodat er iets
	-- gebeurt, maar zonder tag/wapens/geld.
	warn("[ForeverIntegration] _G.FVRGivePack niet gevonden — FVRStore.server.lua nog niet bijgewerkt? Val terug op basisversie.")

	local folder = player:FindFirstChild("OwnedPacks")
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = "OwnedPacks"
		folder.Parent = player
	end

	local flag = folder:FindFirstChild(payload.packName)
	if not flag then
		flag = Instance.new("BoolValue")
		flag.Name = payload.packName
		flag.Parent = folder
	end
	flag.Value = true

	return true, ("Pack '%s' gemarkeerd als owned (BASISVERSIE — update FVRStore.server.lua voor volledige functionaliteit)"):format(payload.packName)
end

----------------------------------------------------------------
-- CHECK MONEY (read-back command)
----------------------------------------------------------------

CommandHandlers["check_money"] = function(player, payload)
	local economy = player:FindFirstChild("Economy")
	if not economy then
		return false, "Economy folder niet gevonden"
	end

	local parts = {}

	local contant = economy:FindFirstChild(Config.EconomyContantValueName)
	if contant then
		table.insert(parts, ("Contant: %d"):format(contant.Value))
	end

	local bank = economy:FindFirstChild(Config.EconomyBankValueName)
	if bank then
		table.insert(parts, ("Bank: %d"):format(bank.Value))
	end

	local coins = economy:FindFirstChild("FVRCOINS")
	if coins then
		table.insert(parts, ("FVR Coins: %d"):format(coins.Value))
	end

	if #parts == 0 then
		return false, "Geen geld-waardes gevonden onder Economy"
	end

	return true, table.concat(parts, " | ")
end

----------------------------------------------------------------
-- CHECK INVENTORY (read-back command)
----------------------------------------------------------------

CommandHandlers["check_inventory"] = function(player, payload)
	if not _G.OxGetSession then
		return false, "Ox_Inventory _G functies niet beschikbaar (script niet geladen?)"
	end

	local session = _G.OxGetSession(player)
	if not session then
		return false, "Geen actieve Ox inventory sessie voor deze speler"
	end

	local parts = {}
	for _, item in pairs(session.inventory) do
		if type(item) == "table" and item.Name then
			table.insert(parts, ("%dx %s"):format(item.Count or 1, item.Name))
		end
	end

	if #parts == 0 then
		return true, "Inventory is leeg"
	end

	-- /roblox/complete truncates result to 1000 chars — keep it well under that.
	local text = table.concat(parts, ", ")
	if #text > 900 then
		text = text:sub(1, 900) .. "... (afgekapt)"
	end

	return true, text
end

----------------------------------------------------------------
-- CHECK STATS (read-back command, used by /playerstats as a live fallback)
----------------------------------------------------------------

CommandHandlers["check_stats"] = function(player, payload)
	local parts = {}

	local economy = player:FindFirstChild("Economy")
	if economy then
		local contant = economy:FindFirstChild(Config.EconomyContantValueName)
		if contant then table.insert(parts, ("Contant: %d"):format(contant.Value)) end
		local bank = economy:FindFirstChild(Config.EconomyBankValueName)
		if bank then table.insert(parts, ("Bank: %d"):format(bank.Value)) end
	end

	local xp = player:FindFirstChild(Config.XpValueName)
	if xp then table.insert(parts, ("XP: %d"):format(xp.Value)) end

	local playtime = player:FindFirstChild(Config.PlaytimeValueName)
	if playtime then table.insert(parts, ("Playtime: %d min"):format(playtime.Value)) end

	if #parts == 0 then
		return false, "Geen stats-waardes gevonden"
	end

	return true, table.concat(parts, " | ")
end

CommandHandlers["kick"] = function(player, payload)
	local reason = payload.reason or "Gekickt door management"
	player:Kick("Forever RP: " .. reason)
	return true, "Speler gekickt"
end

CommandHandlers["ban"] = function(player, payload)
	local reason = payload.reason or "Geen reden opgegeven"
	player:Kick("Forever RP: Je bent gebanned. Reden: " .. reason)
	return true, "Speler gebanned en gekickt"
end

CommandHandlers["unban"] = function(player, payload)
	-- Unban is enforced via the API ban-status check on join; nothing to do
	-- to the currently connected player (they wouldn't be here if banned).
	return true, "Unban verwerkt"
end

----------------------------------------------------------------
-- ANNOUNCE
----------------------------------------------------------------

-- Replace this with your own GUI system. This is a minimal, easily
-- replaceable implementation using a client-side message via a
-- ScreenGui built on the fly for every player.
local function announceToAllPlayers(message)
	for _, player in ipairs(Players:GetPlayers()) do
		local playerGui = player:FindFirstChild("PlayerGui")
		if playerGui then
			local existing = playerGui:FindFirstChild("ForeverAnnouncement")
			if existing then
				existing:Destroy()
			end

			local gui = Instance.new("ScreenGui")
			gui.Name = "ForeverAnnouncement"
			gui.ResetOnSpawn = false

			local frame = Instance.new("Frame")
			frame.Size = UDim2.new(0, 500, 0, 80)
			frame.Position = UDim2.new(0.5, -250, 0, 20)
			frame.BackgroundColor3 = Color3.fromRGB(30, 58, 138) -- Forever RP dark blue
			frame.BorderSizePixel = 0
			frame.Parent = gui

			local corner = Instance.new("UICorner")
			corner.CornerRadius = UDim.new(0, 8)
			corner.Parent = frame

			local label = Instance.new("TextLabel")
			label.Size = UDim2.new(1, -20, 1, -20)
			label.Position = UDim2.new(0, 10, 0, 10)
			label.BackgroundTransparency = 1
			label.TextColor3 = Color3.fromRGB(255, 255, 255)
			label.TextWrapped = true
			label.TextScaled = false
			label.TextSize = 18
			label.Font = Enum.Font.GothamBold
			label.Text = "📢 " .. message
			label.Parent = frame

			gui.Parent = playerGui

			task.delay(10, function()
				if gui and gui.Parent then
					gui:Destroy()
				end
			end)
		end
	end
end

CommandHandlers["announce"] = function(_, payload)
	announceToAllPlayers(payload.message)
	return true, "Aankondiging weergegeven"
end

CommandHandlers["shutdown"] = function(_, payload)
	local delaySeconds = tonumber(payload.delaySeconds) or 10
	local message = payload.message or "De server gaat binnenkort herstarten."

	announceToAllPlayers(("%s (herstart over %ds)"):format(message, delaySeconds))

	-- Kick everyone after the countdown. Fired off async so this handler can
	-- report success immediately without blocking the polling loop.
	task.spawn(function()
		task.wait(delaySeconds)
		for _, plr in ipairs(Players:GetPlayers()) do
			plr:Kick("Forever RP: " .. message)
		end
	end)

	return true, ("Shutdown gepland over %d seconden"):format(delaySeconds)
end

----------------------------------------------------------------
-- BAN CHECK ON JOIN
----------------------------------------------------------------

local function isBanned(userId)
	local result = apiRequest("GET", "/players/" .. tostring(userId) .. "/ban-status", nil)
	if not result then
		-- Fail open or closed depending on your risk tolerance. Fail-closed
		-- (treat as not banned) avoids locking out the whole server if the
		-- API is briefly unreachable. Change to `return true` to fail-closed
		-- the other way if you prefer stricter enforcement.
		return false
	end
	return result.banned == true, result.reason
end

----------------------------------------------------------------
-- WHITELIST CHECK ON JOIN (only enforced when Config.WhitelistEnabled = true)
----------------------------------------------------------------

local function isWhitelisted(userId)
	local result = apiRequest("GET", "/whitelist/status/" .. tostring(userId), nil)
	if not result then
		-- Fail open — same reasoning as isBanned above: don't lock out the
		-- whole server if the API is briefly unreachable.
		return true
	end
	return result.whitelisted == true
end

local function banPlayer(player, reason)
	player:Kick("Forever RP: Je bent gebanned. Reden: " .. tostring(reason or "Geen reden opgegeven"))
end

Players.PlayerAdded:Connect(function(player)
	task.spawn(function()
		local banned, reason = isBanned(player.UserId)
		if banned then
			banPlayer(player, reason)
			return
		end

		if Config.WhitelistEnabled and not isWhitelisted(player.UserId) then
			player:Kick("Forever RP: Je staat niet op de whitelist. Neem contact op met staff.")
		end
	end)
end)

----------------------------------------------------------------
-- IN-GAME /verify CHAT COMMAND
----------------------------------------------------------------
-- Players type: /verify FVR-ABC123  in the Roblox chat to link their account.

local function handleVerifyChat(player, message)
	local code = message:match("^/verify%s+(FVR%-[A-Z0-9]+)$")
	if not code then
		return
	end

	local response = apiRequest("POST", "/verification/complete", {
		code = code,
		robloxId = tostring(player.UserId),
		robloxUsername = player.Name,
	})

	if response and response.success then
		-- Replace with your own notification GUI/system if desired.
		local ok = pcall(function()
			game:GetService("StarterGui"):SetCore("SendNotification", {
				Title = "Forever RP",
				Text = "Account succesvol gekoppeld aan Discord!",
				Duration = 5,
			})
		end)
		if not ok then
			print(("[ForeverIntegration] %s heeft zijn account gekoppeld."):format(player.Name))
		end
	else
		warn(("[ForeverIntegration] Verificatie mislukt voor %s met code %s"):format(player.Name, code))
	end
end

Players.PlayerAdded:Connect(function(player)
	player.Chatted:Connect(function(message)
		handleVerifyChat(player, message)
	end)
end)

----------------------------------------------------------------
-- STAFF DIENST TRACKING (voor /staffactivity)
----------------------------------------------------------------
-- Luistert naar de bestaande "Staffdienst" BoolValue die je eigen
-- hesje-script (aan/uit knop) al onder de Player zet/toggelt. Dit script
-- MAAKT of WIJZIGT die waarde niet — het rapporteert alleen elke
-- verandering naar de API, zodat /staffactivity live kan meekijken.

local function reportStaffDuty(player, onDuty)
	apiRequest("POST", "/staff-duty/toggle", {
		robloxId = tostring(player.UserId),
		robloxUsername = player.Name,
		onDuty = onDuty,
	})
end

local function watchStaffDuty(player)
	local staffDutyValue = player:WaitForChild(Config.StaffDutyValueName, 10)
	if not staffDutyValue or not staffDutyValue:IsA("BoolValue") then
		return -- speler heeft geen staff-toegang / waarde nog niet aangemaakt
	end

	reportStaffDuty(player, staffDutyValue.Value) -- rapporteer initiële status (meestal false bij join)

	staffDutyValue.Changed:Connect(function(newValue)
		reportStaffDuty(player, newValue)
	end)
end

Players.PlayerAdded:Connect(function(player)
	task.spawn(watchStaffDuty, player)
end)

Players.PlayerRemoving:Connect(function(player)
	-- Veiligheidsnet: als een staff-lid de server verlaat terwijl hij/zij nog
	-- in dienst staat, sluit de dienst-sessie hier alsnog af.
	reportStaffDuty(player, false)
end)

----------------------------------------------------------------
-- STATS REPORTING (voor /playerstats en /leaderboard)
----------------------------------------------------------------
-- Rapporteert periodiek een snapshot van elke online speler, zodat de
-- Discord-kant deze data kan tonen zonder de speler live te hoeven pollen.

local function reportPlayerStats(player)
	local economy = player:FindFirstChild("Economy")
	local cash = economy and economy:FindFirstChild(Config.EconomyContantValueName)
	local bank = economy and economy:FindFirstChild(Config.EconomyBankValueName)
	local xp = player:FindFirstChild(Config.XpForStatsValueName)
	local playtime = player:FindFirstChild(Config.PlaytimeValueName)

	apiRequest("POST", "/player-stats/report", {
		robloxId = tostring(player.UserId),
		robloxUsername = player.Name,
		cash = cash and cash.Value or 0,
		bank = bank and bank.Value or 0,
		xp = xp and xp.Value or 0,
		playtimeMinutes = playtime and playtime.Value or 0,
	})
end

task.spawn(function()
	while true do
		task.wait(Config.StatsReportInterval)
		for _, player in ipairs(Players:GetPlayers()) do
			reportPlayerStats(player)
		end
	end
end)

----------------------------------------------------------------
-- COMMAND POLLING LOOP
----------------------------------------------------------------

local function getOnlineUserIds()
	local ids = {}
	for _, player in ipairs(Players:GetPlayers()) do
		table.insert(ids, tostring(player.UserId))
	end
	-- Always poll for broadcast/announce commands even with 0 players online.
	if #ids == 0 then
		table.insert(ids, "0")
	end
	return ids
end

local function completeCommand(commandId, success, resultText)
	apiRequest("POST", "/roblox/complete", {
		commandId = commandId,
		success = success,
		result = resultText,
	})
end

local function processCommand(command)
	-- Duplicate-execution protection: skip if we've already processed this
	-- command ID in this server session.
	if processedCommandIds[command.id] then
		return
	end
	processedCommandIds[command.id] = true

	local handler = CommandHandlers[command.type]
	if not handler then
		completeCommand(command.id, false, "Geen handler voor type: " .. tostring(command.type))
		return
	end

	-- Broadcast-type commands (announce, shutdown) don't target a specific player.
	if command.type == "announce" or command.type == "shutdown" then
		local ok, message = handler(nil, command.payload)
		completeCommand(command.id, ok, message)
		return
	end

	local targetPlayer = Players:GetPlayerByUserId(tonumber(command.robloxId))
	if not targetPlayer then
		-- Player isn't in this server instance — leave it for another server
		-- (or a future poll once they join) by NOT marking success. We still
		-- report failure so the queue doesn't stall on this instance, but
		-- since /roblox/complete moves it to "failed" (not deleted), consider
		-- building a retry mechanism in the API if commands must reach
		-- offline players. For now, admin commands are expected to run while
		-- the target player is online.
		completeCommand(command.id, false, "Speler niet gevonden in deze server-instance")
		return
	end

	local ok, message = handler(targetPlayer, command.payload)
	completeCommand(command.id, ok, message)
end

local function pollCommands()
	local response = apiRequest("POST", "/roblox/poll", {
		robloxIds = getOnlineUserIds(),
		jobId = game.JobId,
	})

	if not response or not response.commands then
		return
	end

	for _, command in ipairs(response.commands) do
		processCommand(command)
	end
end

----------------------------------------------------------------
-- HEARTBEAT LOOP
----------------------------------------------------------------

local function sendHeartbeat()
	apiRequest("POST", "/roblox/heartbeat", {
		jobId = game.JobId,
		players = #Players:GetPlayers(),
		maxPlayers = Players.MaxPlayers,
	})
end

----------------------------------------------------------------
-- MAIN LOOPS
----------------------------------------------------------------

task.spawn(function()
	while true do
		task.wait(Config.PollInterval)
		pollCommands()
	end
end)

task.spawn(function()
	while true do
		sendHeartbeat()
		task.wait(Config.HeartbeatInterval)
	end
end)

print("[ForeverIntegration] Forever RP Discord integratie geladen.")
