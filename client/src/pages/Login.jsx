
export default function Login() {

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState()

    async function handleSubmit(e) {
        e.preventDefault()
        // do a GET to db and approve of the user
    }

    return (
        <>
            <h1>Login</h1>
            <form onSubmit={handleSubmit}>
                <label>
                    Username
                    <input type="text" onChange={(e) => setUsername(e.target.value)}/>
                </label>
                <label>
                    Password
                    <input type="password" onChange={(e) => setPassword(e.target.value)}/>   
                </label>
            </form>
        </>
    )
}