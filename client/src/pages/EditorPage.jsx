import { useParams, Link } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { nord } from "@uiw/codemirror-theme-nord";
import { useDocument } from "../hooks/useDocument";

export default function EditorPage() {
  const { id } = useParams();

  const {
    document,
    content,
    setContent,
    loading,
    error,
    saveStatus,
  } = useDocument(id);

  if (loading) return <h1>Loading document...</h1>;
  if (error) return <h1>{error}</h1>;
  if (!document) return <h1>Document not found</h1>;

  return (
    <div>
      <Link to="/documents">Back</Link>

      <header>
        <h1>{document.title}</h1>
        <p>{saveStatus}</p>
      </header>

      <CodeMirror
        value={content}
        extensions={[markdown()]}
        height="calc(100vh - 160px)"
        onChange={(value) => setContent(value)}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          foldGutter: true,
        }}
        theme={nord}
      />
    </div>
  );
}
    // TODO: remove later if needed
    // useEffect(() => {
    //     async function getContent() {
    //         const res = await fetch(`${API}/documents/${id}`, {
    //         method: "GET",
    //         headers: {"Content-Type":"application/json"},
    //         credentials: "include"
    //     })
    //     if (!res.ok) throw new Error("failed to load")
    //     return res.json()
    // }
    //     getContent().then((data)=>{
    //         setDocument(data)
    //         setContent(data.content ?? "")
    //     }).catch((err)=>console.error(err))
    // }, [id])
    


    // useEffect(() => {
    //     const timer = setTimeout(async () => {
    //         if (!document) return
    //         const res = await fetch(`${API}/documents/${id}/content`, {
    //             method: "PUT",
    //             headers: {"Content-Type":"application/json"},
    //             credentials: "include",
    //             body: JSON.stringify({content})
    //         })
    //         if (!res.ok) throw new Error("save failed")
    //     }, 1000) // Wait 1 second after user stops typing
        
    //     return () => clearTimeout(timer) // Cleanup timer if content changes again
    // }, [content, id, document])
    
    // function saveToContent(e) {
    //     e.preventDefault()
    //     // Content is auto-saved by the useEffect above
    // }
    
    // if (!document) return <h1>Loading...</h1>
    
    // return (
    //     <div className="">
    //         <header className="title">{document.title}</header>
    //         <form>
    //             <CodeMirror 
    //                 value={content}
    //                 extensions={[markdown()]}
    //                 height="calc(100vh - 160px)"
    //                 onChange={(value) => setContent(value)}
    //                 basicSetup={{
    //                     lineNumbers: true,
    //                     highlightActiveLine: true,
    //                     foldGutter: true,
    //                 }}
    //                 theme={nord}
    //                 align="left"
    //             />
    //             <button className="btn btn-primary bg-black" type= "submit" onClick={saveToContent}>Save</button>
    //         </form>
            
    //     </div>
    // )