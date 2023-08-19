let songIndex = 1;
let audioElement = new Audio(`1.mp3`);
let mainPlay = document.getElementById("mainPlay");
let progressBar = document.getElementById("progressBar");
let son = document.getElementById(`${songIndex}`);
let curr = document.getElementById("nowPlaying");

let songs = [
    {songName: "Metamorphosis", path:"1.mp3"},
    {songName: "Rapture", path:"2.mp3"},
    {songName: "Starboy", path:"3.mp3"},
    {songName: "Cheques", path:"4.mp3"},
    {songName: "Diggy(Jim Do)", path:"5.mp3"},
    {songName: "Unravel", path:"6.mp3"},
    {songName: "Patola", path:"7.mp3"},
    {songName: "Itachi", path:"8.mp3"}
]



mainPlay.addEventListener("click", function(){
    if(audioElement.paused || audioElement.currentTime <= 0){
        audioElement.play();
        curr.innerText = songs[songIndex-1].songName;
        mainPlay.classList.remove("ri-play-fill");
        mainPlay.classList.add("ri-pause-fill");
        son = document.getElementById(`${songIndex}`);
        son.classList.remove("ri-play-circle-line");
        son.classList.add("ri-pause-circle-line");
    } 
    else{
        audioElement.pause();
        mainPlay.classList.remove("ri-pause-fill");
        mainPlay.classList.add("ri-play-fill");
        son = document.getElementById(`${songIndex}`);
        son.classList.remove("ri-pause-circle-line");
        son.classList.add("ri-play-circle-line");
    }
})

audioElement.addEventListener("timeupdate",()=>{
    progress = parseFloat((audioElement.currentTime/audioElement.duration)*100);
    progressBar.value = progress;
})


progressBar.addEventListener("change",function(){
    audioElement.currentTime = ((progressBar.value * audioElement.duration)/100);
})

const makePlay = () => {
    Array.from(document.getElementsByClassName("miniCircle")).forEach((elem)=>{
        elem.classList.remove("ri-pause-circle-line");
        elem.classList.add("ri-play-circle-line");
    });
}

Array.from(document.getElementsByClassName("miniCircle")).forEach((element)=>{
    element.addEventListener("click",(e)=>{
        makePlay();
        songIndex = parseInt(e.target.id);
        e.target.classList.remove("ri-play-circle-line");
        e.target.classList.add("ri-pause-circle-line");
        audioElement.src = `${songIndex}.mp3`;
        curr.innerText = songs[songIndex-1].songName;
        audioElement.currentTime = 0;
        audioElement.play();
        mainPlay.classList.remove("ri-play-fill");
        mainPlay.classList.add("ri-pause-fill");
        progressBar.value = 0;
    })
})

document.getElementById("nxt").addEventListener("click",function(){
    makePlay();
    if(songIndex >= 8){
        songIndex = 0;
    }
    else{
        songIndex +=1;
    }
    son = document.getElementById(`${songIndex}`);
    son.classList.remove("ri-play-circle-line");
    son.classList.add("ri-pause-circle-line");
    curr.innerText = songs[songIndex-1].songName;
    audioElement.src = `${songIndex}.mp3`;
    audioElement.currentTime = 0;
    audioElement.play();
    mainPlay.classList.remove("ri-play-fill");
    mainPlay.classList.add("ri-pause-fill");
    progressBar.value = 0;
    
});

document.getElementById("pre").addEventListener("click",function(){
    makePlay();
    if(songIndex <= 0){
        songIndex = 8;
    }
    else{
        songIndex -=1;
    }
    son = document.getElementById(`${songIndex}`);
    son.classList.remove("ri-play-circle-line");
    son.classList.add("ri-pause-circle-line");
    audioElement.src = `${songIndex}.mp3`;
    curr.innerText = songs[songIndex-1].songName;
    audioElement.currentTime = 0;
    audioElement.play();
    mainPlay.classList.remove("ri-play-fill");
    mainPlay.classList.add("ri-pause-fill");
    progressBar.value = 0;
});

audioElement.addEventListener("ended", function() {
    mainPlay.classList.remove("ri-pause-fill");
    mainPlay.classList.add("ri-play-fill");
    progressBar.value = 0;
});


