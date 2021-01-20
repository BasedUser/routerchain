UnitTypes.block.speed=32;
UnitTypes.gamma.weapons.get(0).bullet.damage=2;
var tAssign=true;
var playerTeams = new Seq(); // PlayerTeam = {Team, boolean locked, String[] uuid}
var rejoinTimeouts = new ObjectMap(32); // {String uuid: [Team, long timestamp]}
// Why UUID? It's the only way I can reliably test a player against another, besides USID and IP.
// This may or may not allow crossplay.
var baseTimeout = 5 * 60 * 1000;
var findp=(name)=>Groups.player.find(p=>Strings.stripColors(p.name.toLowerCase()).includes(name.toLowerCase()));
var getByUUID=(id)=>{
    return Groups.player.find(p=>{p.uuid()==id});
}
var tryRemoveTeam=(t)=>{
    t = getTeam(t);
    if(t == null) return;
    if(t.get(2).size == 0) {
        playerTeams.remove(t);
    }
}
var getRandTeam=()=>{
	let aTeams=Vars.state.teams.active; // for each team in playerTeams, if it's locked, remove it from aTeams
    playerTeams.each(t=>{
        if(t.get(1)){
            aTeams.remove(Teams.get(t.get(0)));
        }
    });
    if(aTeams.size == 0) {
        return Team.derelict; // no teams
    }
	return aTeams.get(Math.floor(Mathf.random(0,aTeams.size))).team;
}
var getTeam=t=>{
    return playerTeams.find(s=>{
        return s.get(0)==t
    });
}
var setTeam=(p,t)=>{
    if(getTeam(p.team()) != null) {
        getTeam(p.team()).get(2).remove(p.uuid());
        tryRemoveTeam(p.team());
    } // not in that team anyway
    p.team(t);
    if(getTeam(t) == null) {
        let newTeam = new Seq();
        newTeam.add(t);
        newTeam.add(false);
        let players = new Seq();
        players.add(p.uuid());
        newTeam.add(players);
        playerTeams.add(newTeam);
    } else {
        getTeam(t).get(2).add(p.uuid());
    }
}
Events.on(PlayerJoin,e=>{
	if(tAssign){
        if(rejoinTimeouts.containsKey(e.player.uuid())){
            let snapshot = rejoinTimeouts.get(e.player.uuid());
            let team = snapshot.get(0);
            let time = snapshot.get(1);
            if(time + baseTimeout > Time.millis() && team.core() != null) {
                e.player.team(team);
                rejoinTimeouts.remove(e.player.uuid());
                Call.infoMessage(e.player.con,"Your session has been restored.");
                e.player.name += " [#"+e.player.team().color+"]("+e.player.team().name.split("#").pop()+")";
                return; // success
            } else if (team.core() == null) {
                Call.infoMessage(e.player.con,"Your team's ("+team.name+") core is currently destroyed.\nBecause of that, you were reassigned to another team.");
                if(getTeam(team) != null){
                    getTeam(team).get(2).remove(e.player.uuid());
                } else {
		    Log.info("Attempt to remove player "+e.player.name+"from nonexistent player team "+team.name+"! (main.js:71)");
		}
                tryRemoveTeam(team);
            } else {
                Call.infoMessage(e.player.con,"You have timed out, and were reassigned to another team.");
            }
            //unsuccessful
            rejoinTimeouts.remove(e.player.uuid());
        }
        e.player.team(Team.derelict);
        setTeam(e.player,getRandTeam());
        e.player.name += " [#"+e.player.team().color+"]("+e.player.team().name.split("#").pop()+")";
        if(e.player.con.mobile){
            Call.infoMessage(e.player.con,"Your core is located at "+e.player.team().core().x/8+", "+e.player.team().core().y/8+".");//\n\nUse !help for a list of Hex commands.");
        } else {
            Call.infoMessage(e.player.con,"Use !help for a list of Hex commands.");
        }
	}
});
Events.on(PlayerLeave,e=>{
    if(e.player.team().core() == null) {
        if(getTeam(e.player.team()) == null) {
            Log.info("Attempt to remove player "+e.player.name+" from nonexistent player team "+e.player.team().name+"!");
        } else getTeam(e.player.team()).get(2).remove(e.player.uuid());
        tryRemoveTeam(e.player.team());
        return; // there is no timeout for rejoining a dead team, even if their core will be built later
    };
    let payload = new Seq();
    payload.add(e.player.team());
    payload.add(Time.millis());
    rejoinTimeouts.put(e.player.uuid(),payload);
    Timer.schedule(()=>{
        if(!Groups.player.contains(p=>{return p.uuid()==e.player.uuid()}) &&
            ((payload.get(1) + baseTimeout) < Time.millis())
        ) {
            if(getTeam(payload.get(0)) != null) {
                getTeam(payload.get(0)).get(2).remove(e.player.uuid());
            }
            tryRemoveTeam(payload.get(0));
        }
    },baseTimeout/1000)
});
Events.on(GameOverEvent,e=>{
    Timer.schedule(()=>{
        playerTeams.clear();
        rejoinTimeouts.clear();
        Groups.player.each(p=>{Call.connect(p.con,"routerchain.ddns.net",6567)})
    },11.7);
});
Events.on(PlayerChatEvent,e=>{
    if(e.message[0] == "!") {
        e.player.sendMessage("Commands are not implemented yet.");
        let command = e.message.split(" ")[0];
        // *please* don't do this
        if(command == "!promote") {
            let team = getTeam(e.player.team());
            if(team == null) {
                e.player.sendMessage("[red][E][white]: Your team "+e.player.team().name+" is not assigned to a valid player team. QUITTING");
            } else {
                if(e.player.uuid() != team.get(2).get(0)) {
                    e.player.sendMessage("[royal][I][white]: You are not the owner of this team.\n[yellow][W][]: As of this moment, the voting system does not exist. Pray to your party leader he spares you.");
                } else {
                    let player = findp(e.message.slice(9));
                    if(player == null) {
                        e.player.sendMessage("[royal][I][white]: Player "+e.message.slice(9)+"[white] not found.");
                    } else {
                        // would you listen, i am not the messiah
                        let i = team.get(2).indexOf(player);
                        team.get(2).swap(0,i); // HE IS THE MESSIAH
                        team.get(2).each(p=>{
                            p = getByUUID(p);
                            if(p != null) {
                                p.sendMessage(player.name+" was promoted to leader!");
                            }
                        });
                    }
                }
            }
        } else if (command == "!leave") {
            
        } else {
            e.player.sendMessage("[red][E][white]: Unknown command. Type !help for a list of commands.");
        }
        throw new Exception("command end");
    }
});
