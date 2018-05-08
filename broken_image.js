document.addEventListener("DOMContentLoaded", function(event) {
   document.querySelectorAll('img').forEach(function(img){
    img.onerror = function(){
      this.src="./assorted/logo_assets/spotify-icon-black.png";
    };
   })
});
