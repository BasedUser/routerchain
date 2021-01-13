UnitTypes.block.speed=32;
UnitTypes.gamma.weapons.get(0).bullet.damage=2;
var getRandTeam=()=>{
	var aTeams=Vars.state.teams.active;
	return aTeams.get(Math.floor(Mathf.random(0,aTeams.size))).team;
}
var tAssign=true;
Events.on(PlayerJoin,e=>{
	if(tAssign){
		e.player.team(getRandTeam());
		e.player.name += " [#"+e.player.team().color+"]("+e.player.team().name.split("#")[1]+")";
		if(e.player.con.mobile){
			Call.infoMessage(e.player.con,"Your core is located at "+e.player.team().core().x/8+", "+e.player.team().core().y/8+".");
		}
	}
});
